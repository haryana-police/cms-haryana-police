import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

file_path = r'e:\Case Management System\src\components\complaints\ComplaintWizard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Find and remove the bad lines (between line 638 and 643)
# Look for line with Hindi chars in the 635-650 range
bad_start = -1
for i, line in enumerate(lines):
    if i < 632 or i > 650:
        continue
    has_non_ascii = any(ord(c) > 127 for c in line)
    print(f"Line {i+1}: has_non_ascii={has_non_ascii}, preview={repr(line[:40])}")
    if has_non_ascii and ');' in line:
        bad_start = i
        print(f"  ^ THIS IS THE BAD LINE")

if bad_start >= 0:
    print(f"\nRemoving lines {bad_start+1} to {bad_start+5}")
    del lines[bad_start:bad_start+5]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Done! File saved.")
else:
    print("Bad line not found in expected range, file may already be clean")
