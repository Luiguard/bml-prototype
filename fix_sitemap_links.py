import re

file_path = '/home/benjamin/projects/mediclean-pro/sitemap.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace href="filename.bweb?query" with href="polyfill.html?file=filename.bweb&query"
# Wait, actually we can just capture the bweb filename and any subsequent query params.
def replace_link(match):
    full_match = match.group(0)
    prefix = match.group(1) # href="
    filename = match.group(2) # e.g. index.bweb
    query = match.group(3) # e.g. ?type=hygiene or empty
    
    if query:
        # replace ? with &
        query = '&' + query[1:]
    else:
        query = ''
        
    return f'{prefix}polyfill.html?file={filename}{query}"'

new_content = re.sub(r'(href=["\'])([^"\']+\.bweb)(\?[^"\']*)?"', replace_link, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Updated sitemap.html links")
