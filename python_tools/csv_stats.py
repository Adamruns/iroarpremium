import csv
import os
from collections import defaultdict


def analyze_csv_columns(directory):
    # Iterate through all CSV files in the directory
    for filename in os.listdir(directory):
        if filename.endswith('.csv'):
            filepath = os.path.join(directory, filename)
            print(f"\nAnalyzing file: {filename}")

            # Dictionary to keep track of row counts and example row for each column count
            column_data = defaultdict(lambda: {'count': 0, 'example_row': None})

            # Read the CSV file
            with open(filepath, mode='r', encoding='utf-8', newline='') as csvfile:
                reader = csv.reader(csvfile)
                for row in reader:
                    num_columns = len(row)
                    column_data[num_columns]['count'] += 1  # Increment row count for this column count
                    # Save an example row if one hasn't been saved for this column count
                    if column_data[num_columns]['example_row'] is None:
                        column_data[num_columns]['example_row'] = row

            # Print the results for the file
            for num_columns, data in sorted(column_data.items()):
                print(f"  Rows with {num_columns} columns: {data['count']}")
                print(f"    Example row: {data['example_row']}")


# Usage
directory_path = '../grade_distributions'  # Replace with your directory containing CSV files
analyze_csv_columns(directory_path)