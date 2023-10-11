const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));


app.post('/scrape', async (req, res) => {
    try {
        const url = req.body.url;

        if (!url) {
            return res.send('URL is required.');
        }
        
        const browser = await puppeteer.launch().catch(error => console.error("Failed to launch browser:", error));
        if (!browser) return res.send('Failed to launch the browser');
        const page = await browser.newPage();
        await page.goto(url);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const content = await page.content();
        console.log(content);
        const $ = cheerio.load(content);

        const articles = [];

        $('time').each((i, element) => {
            console.log($(element).html());
            const date = $(element).text().trim();
            const title = $(element).parent().next().children().first().text().trim();
            const short_description = $(element).parent().next().children().next().text().trim();
            const author = $(element).parent().next().next().children().children().first().text().trim();
            const author_proffesion = $(element).parent().next().next().children().children().next().text().trim();


            console.log({ date, title, short_description, author, author_proffesion });
                articles.push({ date, title, short_description, author, author_proffesion });
        });

        await browser.close();
        console.log('Sending Response:', articles);
        res.json(articles);
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to scrape content.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
