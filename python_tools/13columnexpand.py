import csv
import os


def convert_to_17_columns(input_file, output_file):
    fixed_rows = []

    with open(input_file, mode='r', newline='', encoding='utf-8') as infile:
        reader = csv.reader(infile)

        for row in reader:
            if len(row) == 13:
                # Insert four empty columns at positions 12, 13, 14, 15 (I, SCP, SCN, SCD)
                row.insert(12, '')  # I
                row.insert(13, '')  # SCP
                row.insert(14, '')  # SCN
                row.insert(15, '')  # SCD
            # Append the adjusted row (which will now have 17 columns) to fixed_rows
            fixed_rows.append(row)

    # Write the adjusted rows to a new CSV file
    with open(output_file, mode='w', newline='', encoding='utf-8') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(fixed_rows)

    print(f"Converted file saved to {output_file}")


def process_files_with_13_columns(directory, output_directory):
    files_to_process = [
        '2017Fall.csv', '2015Spring.csv', '2016Fall.csv', '2018Spring.csv',
        '2014Fall.csv', '2014Spring.csv', '2019Spring.csv', '2015Fall.csv',
        '2019Fall.csv', '2018Fall.csv', '2017Spring.csv', '2016Spring.csv'
    ]

    # Ensure the output directory exists
    os.makedirs(output_directory, exist_ok=True)

    for filename in files_to_process:
        input_file = os.path.join(directory, filename)
        output_file = os.path.join(output_directory, filename)
        convert_to_17_columns(input_file, output_file)


# Usage
input_directory = 'grade_distributions_revised'  # Directory containing the original CSV files
output_directory = 'grade_distributions_final'  # Directory to save revised CSV files
process_files_with_13_columns(input_directory, output_directory)
