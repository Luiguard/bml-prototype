import re

# Read converter.html
with open('/home/benjamin/projects/bml-prototype/converter.html', 'r', encoding='utf-8') as f:
    converter = f.read()

# Extract the parser block we want to sync (from TAG_REV to just before function parseBWEB)
match = re.search(r'(const TAG_REV=\{.+?)(?=function parseBWEB)', converter, re.DOTALL)
if not match:
    print("Could not extract from converter.html")
    exit(1)

parser_code = match.group(1).strip() + '\n\n'

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace everything from `const TAG_REV=\{` up to `// BWEB Container Section Unpacker` or `function parseBWEB`
    # Let's find the start and end
    start_match = re.search(r'const TAG_REV=\{', content)
    end_match = re.search(r'(// BWEB Container Section Unpacker\s+)?function parseBWEB', content)
    
    if not start_match or not end_match:
        print(f"Could not find bounds in {filepath}")
        return
        
    start_idx = start_match.start()
    end_idx = end_match.start()
    
    new_content = content[:start_idx] + parser_code + content[end_idx:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated {filepath}")

replace_in_file('/home/benjamin/projects/bml-prototype/chrome-extension/content.js')
replace_in_file('/home/benjamin/projects/mediclean-pro/bweb-converter/polyfill.html')
