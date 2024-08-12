import os
import sys
import shutil
import argparse
from datetime import datetime, timedelta

def delete_old_files_and_empty_dirs(base_dir, threshold_date):
    for root, dirs, files in os.walk(base_dir, topdown=False):
        # Extract date from directory name if it follows YYYYMMDD format
        dir_name = os.path.basename(root)
        try:
            dir_date = datetime.strptime(dir_name, '%Y%m%d')
        except ValueError:
            continue  # Skip directories that don't match the date format

        # Check if the directory is older than the threshold date
        if dir_date < threshold_date:
            # Delete all files in the directory
            for file in files:
                file_path = os.path.join(root, file)
                os.remove(file_path)
                print("deleted", file_path)

        # Remove the directory if it is empty
        if not os.listdir(root):
            os.rmdir(root)

def main():
    parser = argparse.ArgumentParser(description='Delete files older than 3 months and remove empty directories.')
    parser.add_argument('path', metavar='PATH', type=str, help='The path to the base directory')

    args = parser.parse_args()

    base_dir = args.path

    # Calculate the date 3 months ago
    three_months_ago = datetime.now() - timedelta(days=90)

    # Run the cleanup
    delete_old_files_and_empty_dirs(base_dir, three_months_ago)

if __name__ == '__main__':
    main()
