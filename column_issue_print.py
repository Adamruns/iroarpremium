import csv
import os


def print_rows_with_13_columns(file_path):
    with open(file_path, mode='r', encoding='utf-8', newline='') as csvfile:
        reader = csv.reader(csvfile)
        rows_with_13_columns = []

        for row in reader:
            if len(row) == 13:
                rows_with_13_columns.append(row)

        # Print all rows with exactly 13 columns
        print(f"Rows with 13 columns in {os.path.basename(file_path)}:")
        for row in rows_with_13_columns:
            print(row)


# Specify the path to the specific file
file_path = 'grade_distributions_revised/2023Fall.csv'  # Update the path if necessary
print_rows_with_13_columns(file_path)
