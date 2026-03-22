#!/usr/bin/env python3
"""
Generate CPU specs mapping for Hetzner servers.

Fetches Geekbench CPU data and matches it against known Hetzner CPU names.
Outputs data/cpu-specs.json with cores, threads, score, and generation info.

Usage:
    python generate_cpu_specs.py [--check]

Options:
    --check   Exit with error if any Hetzner CPU is unmatched (for CI)
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

GEEKBENCH_URL = "https://raw.githubusercontent.com/r59q/geekbench-cpu-specs/refs/heads/master/cpu-list.v1.json"

# Manual overrides for CPUs not in Geekbench or with wrong data.
# Format: normalized_name -> {cores, threads, score, multicore_score, family}
MANUAL_OVERRIDES = {
    "AMD EPYC 7502": {
        "cores": 32,
        "threads": 64,
        "score": 1168,
        "multicore_score": 18500,
        "family": "Zen 2",
    },
    "AMD Ryzen 7 PRO 8700GE": {
        "cores": 8,
        "threads": 16,
        "score": 2700,
        "multicore_score": 12500,
        "family": "Zen 4",
    },
    "Intel Xeon Gold 5412U": {
        "cores": 24,
        "threads": 48,
        "score": 1500,
        "multicore_score": 22000,
        "family": "Sapphire Rapids",
    },
    "Intel Core Ultra 7 265": {
        "cores": 20,
        "threads": 20,
        "score": 2900,
        "multicore_score": 17000,
        "family": "Arrow Lake",
    },
}

# Family overrides for Geekbench entries with missing/empty family field
FAMILY_OVERRIDES = {
    "AMD EPYC 7502P": "Zen 2",
    "AMD EPYC 9454P": "Zen 4",
}


def normalize_cpu_name(name: str) -> str:
    """Normalize a Hetzner CPU name for matching against Geekbench data."""
    # Remove '2x ' or '4x ' prefix (multi-socket)
    name = re.sub(r"^\d+x\s+", "", name)
    # Remove trademark symbols
    name = name.replace("®", "").replace("™", "")
    # Remove 'Prozessor' (German for processor)
    name = name.replace("Prozessor ", "")
    # Collapse whitespace and strip
    name = re.sub(r"\s+", " ", name).strip()
    return name


def normalize_version_spacing(name: str) -> str:
    """Try alternative version number formatting (E3-1270V3 -> E3-1270 v3)."""
    return re.sub(
        r"([A-Za-z0-9])-(\d+)[Vv](\d)",
        lambda m: f"{m.group(1)}-{m.group(2)} v{m.group(3)}",
        name,
    )


def get_socket_count(raw_name: str) -> int:
    """Extract socket/CPU count from raw name (e.g. '2x Intel...' -> 2)."""
    match = re.match(r"^(\d+)x\s+", raw_name)
    return int(match.group(1)) if match else 1


def fetch_geekbench_data() -> dict:
    """Fetch the Geekbench CPU specs JSON."""
    print(f"Fetching Geekbench data from {GEEKBENCH_URL}...")
    req = urllib.request.Request(
        GEEKBENCH_URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; HetznerRadar/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    print(f"Fetched {len(data)} CPU entries")
    return data


def match_cpu(normalized_name: str, gb_data: dict, gb_lower: dict) -> dict | None:
    """Try to match a normalized CPU name against Geekbench data."""
    # Exact match
    if normalized_name in gb_data:
        return gb_data[normalized_name]

    # Case-insensitive match
    if normalized_name.lower() in gb_lower:
        return gb_data[gb_lower[normalized_name.lower()]]

    # Try alternative version spacing
    alt_name = normalize_version_spacing(normalized_name)
    if alt_name in gb_data:
        return gb_data[alt_name]
    if alt_name.lower() in gb_lower:
        return gb_data[gb_lower[alt_name.lower()]]

    return None


def generate_specs(hetzner_cpus: list[str], gb_data: dict) -> tuple[dict, list[str]]:
    """
    Generate CPU specs mapping for a list of Hetzner CPU names.

    Returns:
        tuple: (specs_dict, unmatched_list)
    """
    gb_lower = {k.lower(): k for k in gb_data}
    specs = {}
    unmatched = []

    # Deduplicate by normalized name (many Hetzner names differ only in ®/™)
    seen_normalized = {}
    for raw_name in hetzner_cpus:
        normalized = normalize_cpu_name(raw_name)
        if normalized not in seen_normalized:
            seen_normalized[normalized] = raw_name

    for normalized, raw_example in seen_normalized.items():
        socket_count = get_socket_count(raw_example)

        # Check manual overrides first
        if normalized in MANUAL_OVERRIDES:
            override = MANUAL_OVERRIDES[normalized]
            specs[normalized] = {
                "cores": override["cores"] * socket_count,
                "threads": override["threads"] * socket_count,
                "score": override["score"],
                "multicore_score": override["multicore_score"] * socket_count,
                "family": override["family"],
                "source": "manual",
            }
            continue

        # Try Geekbench match
        gb_entry = match_cpu(normalized, gb_data, gb_lower)
        if gb_entry:
            family = gb_entry.get("family", "") or ""
            # Apply family overrides for entries with missing family
            if not family and normalized in FAMILY_OVERRIDES:
                family = FAMILY_OVERRIDES[normalized]
            specs[normalized] = {
                "cores": gb_entry["cores"] * socket_count,
                "threads": gb_entry["threads"] * socket_count,
                "score": gb_entry["score"],
                "multicore_score": gb_entry["multicore_score"] * socket_count,
                "family": family,
                "source": "geekbench",
            }
        else:
            unmatched.append(normalized)

    return specs, unmatched


def main():
    check_mode = "--check" in sys.argv

    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_path = project_root / "data" / "cpu-specs.json"

    # Fetch Geekbench data
    gb_data = fetch_geekbench_data()

    # Get current Hetzner CPU names from database, JSON file, or existing specs
    db_path = project_root / "static" / "sb.duckdb.wasm"
    cpu_list_path = project_root / "data" / "hetzner-cpus.json"
    hetzner_cpus = []

    # Try database first
    try:
        import duckdb

        if db_path.exists():
            conn = duckdb.connect(str(db_path), read_only=True)
            rows = conn.execute(
                "SELECT DISTINCT cpu FROM server ORDER BY cpu"
            ).fetchall()
            hetzner_cpus = [row[0].strip() for row in rows if row[0]]
            conn.close()
            print(f"Found {len(hetzner_cpus)} distinct CPU models in database")
    except (ImportError, Exception) as e:
        print(f"Could not read database ({e})")

    # Fall back to CPU list file
    if not hetzner_cpus and cpu_list_path.exists():
        with open(cpu_list_path) as f:
            hetzner_cpus = json.load(f)
        print(f"Loaded {len(hetzner_cpus)} CPU models from {cpu_list_path}")

    # If we have an existing specs file, include those CPUs too
    if output_path.exists():
        with open(output_path) as f:
            existing = json.load(f)
        for name in existing:
            # Add as fake "raw" names (already normalized)
            if name not in hetzner_cpus:
                hetzner_cpus.append(name)

    if not hetzner_cpus:
        print("ERROR: No CPU names to match against. Need either database or existing specs.")
        sys.exit(1)

    # Generate specs
    specs, unmatched = generate_specs(hetzner_cpus, gb_data)

    # Report results
    print(f"\nMatched: {len(specs)} CPUs")
    for name, info in sorted(specs.items()):
        print(
            f"  {name:45s} cores={info['cores']:3d} threads={info['threads']:3d} "
            f"score={info['score']:5d} family={info['family']} [{info['source']}]"
        )

    if unmatched:
        print(f"\nUnmatched: {len(unmatched)} CPUs")
        for name in unmatched:
            print(f"  WARNING: {name}")

        if check_mode:
            print("\n--check mode: failing due to unmatched CPUs")
            print("Add manual overrides in MANUAL_OVERRIDES for these CPUs.")
            sys.exit(1)

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Strip 'source' field from output (internal only)
    output = {}
    for name, info in sorted(specs.items()):
        output[name] = {
            "cores": info["cores"],
            "threads": info["threads"],
            "score": info["score"],
            "multicore_score": info["multicore_score"],
            "family": info["family"],
        }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
        f.write("\n")

    print(f"\nWrote {len(output)} entries to {output_path}")


if __name__ == "__main__":
    main()
