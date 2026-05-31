function getMatchedCSSValue(el, property) {
    if (el.style[property]) return el.style[property];
    const sheets = el.ownerDocument.styleSheets;
    for (let i = sheets.length - 1; i >= 0; i--) {
        try {
            const rules = sheets[i].cssRules;
            if (!rules) continue;
            for (let j = rules.length - 1; j >= 0; j--) {
                const rule = rules[j];
                if (rule.type === CSSRule.STYLE_RULE && el.matches(rule.selectorText)) {
                    if (rule.style[property]) return rule.style[property];
                }
            }
        } catch(e) {}
    }
    return null;
}
