import os

path = r'c:\Users\Admin\Documents\baitulamal_2026v1\firestore.rules'
with open(path, 'rb') as f:
    content = f.read()
    print(f"File size: {len(content)}")
    print(f"First 20 bytes: {content[:20]}")
    # Check for BOM
    if content.startswith(b'\xef\xbb\xbf'):
        print("UTF-8 BOM detected")
    
    # Print lines with hex
    lines = content.splitlines()
    for i, line in enumerate(lines[:10]):
        print(f"Line {i+1}: {line.decode('utf-8', errors='replace')} | Hex: {line.hex()}")
