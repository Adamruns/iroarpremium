import csv
import os
import glob

def merge_split_rows(input_file, output_file):
    fixed_rows = []
    previous_row = None

    with open(input_file, mode='r', newline='', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        for row in reader:
            # Remove trailing empty columns (commas) from each row
            while row and row[-1] == '':
                row.pop()

            # Remove "H" in the last column if it's present
            if row and row[-1] == 'H' and len(row) > 1:
                row.pop()  # Remove the "H" column

            # Handle rows with "0%####" issue
            processed_row = []
            for cell in row:
                if cell == "0%####":
                    # Split into two cells "0%" and "####"
                    processed_row.extend(["0%", "####"])
                else:
                    processed_row.append(cell)
            row = processed_row

            # Handle split name rows (rows with mostly commas and a name at the end)
            if all(col == "" for col in row[:-1]) and row[-1].strip().rstrip(','):
                if previous_row is not None:
                    # If the previous row's last name is quoted, merge and re-quote
                    if previous_row[-1].startswith('"') and previous_row[-1].endswith('"'):
                        previous_row[-1] = previous_row[-1].strip('"') + " " + row[-1].strip('",')
                        previous_row[-1] = f'"{previous_row[-1]}"'  # Re-quote
                    else:
                        previous_row[-1] = previous_row[-1].strip(',') + " " + row[-1].strip(',')

            # Handle split rows with a name in the second-last column (e.g., `,,,,,,,,,,,,,,Name,`)
            elif all(col == "" for col in row[:-2]) and row[-2].strip() and row[-1] == "":
                if previous_row is not None:
                    if previous_row[-1].startswith('"') and previous_row[-1].endswith('"'):
                        previous_row[-1] = previous_row[-1].strip('"') + " " + row[-2].strip('",')
                        previous_row[-1] = f'"{previous_row[-1]}"'
                    else:
                        previous_row[-1] = previous_row[-1].strip(',') + " " + row[-2].strip(',')

            else:
                # Save the previous row if it's complete
                if previous_row is not None:
                    fixed_rows.append(previous_row)
                previous_row = row  # Move on to the new row

        # Add the last row after loop ends
        if previous_row is not None:
            fixed_rows.append(previous_row)

    # Write the fixed rows to a new CSV file
    with open(output_file, mode='w', newline='', encoding='utf-8') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(fixed_rows)

    print(f"Fixed CSV saved to {output_file}")

def process_directory(input_directory, output_directory):
    # Ensure the output directory exists
    os.makedirs(output_directory, exist_ok=True)

    csv_files = glob.glob(os.path.join(input_directory, '*.csv'))
    for file_path in csv_files:
        # Generate output file path in the output directory with the same filename
        file_name = os.path.basename(file_path)
        output_file = os.path.join(output_directory, file_name)

        # Process each file and save the output
        merge_split_rows(file_path, output_file)

# Usage
input_directory = 'grade_distributions'  # Directory containing the original CSV files
output_directory = 'grade_distributions_revised'  # Directory to save revised CSV files
process_directory(input_directory, output_directory)
