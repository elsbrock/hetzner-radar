# takes "latest" servers and pushes them to our endpoint
# endpoint will match alerts and send mails

import os
import sys
import time
import duckdb
import requests

ENDPOINT = 'https://server-radar.pages.dev/push'

# Get API key from environment
API_KEY = os.environ.get('API_KEY')

def print_usage():
    print("Usage: python push.py <database_name>")

def read_latest(db_name):
    conn = duckdb.connect(db_name)

    # Execute the SQL query and fetch results into a Pandas DataFrame
    query = """
        SELECT
            * EXCLUDE(information, ram, hdd_arr, nvme_drives,
              sata_drives, hdd_drives, seen),
            information::JSON as information,
            ram::JSON as ram,
            hdd_arr::JSON as hdd_arr,
            nvme_drives::JSON as nvme_drives,
            sata_drives::JSON as sata_drives,
            hdd_drives::JSON as hdd_drives,
            seen::VARCHAR as seen
        FROM server
        WHERE seen > (TIMEZONE('UTC', CURRENT_TIMESTAMP) - INTERVAL '70 minute')::TIMESTAMP
    """
    df = conn.sql(query).fetchdf()
    data = df.to_json(orient='records')

    conn.close()
    return data

def push_data(data):
    # Perform POST request to the endpoint with data as JSON
    start = time.time()
    try:
        response = requests.post(
            ENDPOINT,
            data=data,
            headers={
                'x-auth-key': API_KEY,
                'content-type': 'application/json',
                'origin': 'https://server-radar.pages.dev'
            },
            timeout=30  # Optional: set a timeout for the request
        )
        response.raise_for_status()  # Raises stored HTTPError, if one occurred
    except requests.exceptions.RequestException as e:
        print(f"Error pushing data: {e}")
        sys.exit(1)

    duration = time.time() - start
    print(f"Pushed {len(data)} servers in {duration:.2f} seconds")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print_usage()
        sys.exit(1)  # Exit with error code if usage is incorrect
    else:
        latest = read_latest(sys.argv[1])
        push_data(latest)