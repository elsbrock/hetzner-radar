import json
import sys

def print_usage():
    print("Usage: python extract_json_structure.py <filename>")

def extract_paths(obj, current_path="", paths=None, types=None):
    if paths is None:
        paths = set()
    if types is None:
        types = {}

    if isinstance(obj, dict):
        for key, value in obj.items():
            new_path = f"{current_path}.{key}" if current_path else key
            paths.add(new_path)
            types[new_path] = type(value).__name__
            extract_paths(value, new_path, paths, types)
    elif isinstance(obj, list):
        if obj:  # Only process if the list is not empty
            extract_paths(obj[0], current_path + "[]", paths, types)
        else:
            paths.add(current_path + "[]")
            types[current_path + "[]"] = "list"
    else:
        paths.add(current_path)
        types[current_path] = type(obj).__name__

    return paths, types

def main(filename):
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
        
        paths, types = extract_paths(data)
        
        for path in sorted(paths):
            print(f"{path}: {types[path]}")
    except Exception as e:
        print(f"Error processing file: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print_usage()
    else:
        main(sys.argv[1])
