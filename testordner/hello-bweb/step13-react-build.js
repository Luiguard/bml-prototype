const React = require('react');
const ReactDOMServer = require('react-dom/server');
const fs = require('fs');

const BwebCard = ({ title, text, action, target }) => {
    return React.createElement('div', {
        className: 'card',
        'data-action': action,
        'data-target': target,
        style: {
            padding: '20px',
            margin: '15px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            border: '2px solid transparent',
            transition: 'border 0.2s',
            flex: 1
        }
    }, [
        React.createElement('h2', { key: 'h2', style: { margin: '0 0 10px 0', color: '#2c3e50' } }, title),
        React.createElement('p', { key: 'p', style: { margin: 0, color: '#7f8c8d' } }, text)
    ]);
};

const App = () => {
    return React.createElement('div', {
        style: {
            fontFamily: 'sans-serif',
            backgroundColor: '#f4f6f8',
            minHeight: '100vh',
            padding: '40px'
        }
    }, [
        React.createElement('h1', { key: 'title', style: { textAlign: 'center', color: '#333' } }, 'BWEB ❤️ React (SSR)'),
        React.createElement('div', {
            key: 'grid',
            style: {
                display: 'flex',
                maxWidth: '800px',
                margin: '0 auto',
                gap: '20px'
            }
        }, [
            React.createElement(BwebCard, { key: '1', title: 'React Card 1', text: 'Klick triggert Event.', action: 'log', target: 'card1' }),
            React.createElement(BwebCard, { key: '2', title: 'State Test', text: 'Klicke hier.', action: 'increment', target: 'reactCounter' })
        ]),
        React.createElement('div', {
            key: 'counterBox',
            style: { textAlign: 'center', marginTop: '40px' }
        }, [
            React.createElement('div', {
                key: 'badge',
                style: {
                    display: 'inline-block',
                    padding: '10px 25px',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '24px',
                    fontWeight: 'bold'
                }
            }, [
                "Counter: ",
                React.createElement('span', { key: 'val', 'data-id': 'reactCounter' }, '0')
            ])
        ])
    ]);
};

const html = ReactDOMServer.renderToStaticMarkup(React.createElement(App));
const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin: 0; }</style>
</head>
<body>
    ${html}
</body>
</html>`;

fs.writeFileSync('src/react-index.html', fullHtml);
console.log('React SSR Output written to src/react-index.html');
