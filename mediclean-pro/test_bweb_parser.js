const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const htmlContent = fs.readFileSync('converter.html', 'utf8');
const dom = new JSDOM(htmlContent, { runScripts: "dangerously" });

// Simulate encoding and decoding of a simple node
const html = '<a href="#main-content" class="skip-link">Zum Hauptinhalt springen</a>';

// Let's extract the JS logic from converter.html
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/)[1];

// Evaluate the script inside JSDOM or node
// It might be complex, let's just create a mock bml encoding
