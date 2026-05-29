import re

# Read converter.html
with open('/home/benjamin/projects/bml-prototype/converter.html', 'r', encoding='utf-8') as f:
    converter = f.read()

# Extract applyBLB, applyBIB, applyBVS, applyBAS from converter.html
# Wait, in converter.html, there is NO applyBDT !
# Because BDT is just parsed into nodes for the tree view.
# applyBLB in converter.html looks like:
# function applyBLB(rootEl,blocks){ ... }
# applyBIB(rootEl,imgs){ ... }
# applyBVS(rootEl,videos){ ... }
# applyBAS(rootEl,audios){ ... }

# Let's extract from `function applyBLB` up to `// Progress Bar`
match = re.search(r'(function applyBLB.+?)(?=\s*// Progress Bar|function renderBinary)', converter, re.DOTALL)
if not match:
    # try until function generateBWEB
    match = re.search(r'(function applyBLB.+?)(?=\s*function clientSideConvert|\s*function parseBWEB)', converter, re.DOTALL)

if match:
    apply_funcs = match.group(1).strip()
    print("Found apply functions:\n" + apply_funcs[:200] + "...")
else:
    print("Could not find apply functions in converter.html")
    exit(1)

def replace_apply_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace from `async function applyBDT` or `async function applyBLB`
    # up to `async function renderBinary(buf)`
    start_match = re.search(r'async function applyBDT\(root,nodes\)\{', content)
    if not start_match:
        start_match = re.search(r'function applyBLB', content)
        
    end_match = re.search(r'// Native Render Binary Pipeline\s+async function renderBinary', content)
    if not end_match:
        end_match = re.search(r'async function renderBinary', content)
        
    if not start_match or not end_match:
        print(f"Could not find bounds in {filepath}")
        return
        
    new_content = content[:start_match.start()] + apply_funcs + '\n\n        ' + content[end_match.start():]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated {filepath}")

replace_apply_in_file('/home/benjamin/projects/bml-prototype/chrome-extension/content.js')
replace_apply_in_file('/home/benjamin/projects/mediclean-pro/bweb-converter/polyfill.html')
