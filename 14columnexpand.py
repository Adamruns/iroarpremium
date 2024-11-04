import csv
import os


def expand_to_17_columns(input_file, output_file):
    fixed_rows = []

    with open(input_file, mode='r', newline='', encoding='utf-8') as infile:
        reader = csv.reader(infile)

        for row in reader:
            if len(row) == 14:
                # Insert three empty columns at positions 12, 13, 14 to match the 17-column structure
                row.insert(12, '')  # I
                row.insert(13, '')  # SCP
                row.insert(14, '')  # SCN
            # Append the adjusted row (which will now have 17 columns) to fixed_rows
            fixed_rows.append(row)

    # Write the adjusted rows to a new CSV file
    with open(output_file, mode='w', newline='', encoding='utf-8') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(fixed_rows)

    print(f"Expanded file saved to {output_file}")


# Usage
input_file = 'grade_distributions_revised/2023Fall.csv'  # Path to the original CSV file with 14 columns
output_file = 'grade_distributions_final/2023Fall.csv'  # Path to save the revised CSV file

expand_to_17_columns(input_file, output_file)
