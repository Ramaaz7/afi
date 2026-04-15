const fs = require('fs');
const files = ['index.html', 'app.js', 'styles.css'];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        // Replace indigo with emerald
        content = content.replace(/indigo/g, 'emerald');
        // Replace violet with teal
        content = content.replace(/violet/g, 'teal');
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});
