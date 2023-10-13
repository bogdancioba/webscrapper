const express = require('express');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const path = require('path');

const fs = require('fs');

function saveToFile(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 4));
}


const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function tokenize(text) {
    return text.toLowerCase().split(" ");
}

const positive_words = ["good", "great", "amazing", "love", "positive", "happiness", "beautiful", "joyful", "joy", "delightful","pleasant"];
const negative_words = ["bad", "hate", "awful", "terrible", "negative", "distress", "negatively", "disaster", "pollution"];

function scoreSentiment(text) {
    text = preprocess(text);
    let tokens = tokenize(text);
    let score = 0;

    for(let word of tokens) {
        if (positive_words.includes(word)) {
            score += 1;
        } else if (negative_words.includes(word)) {
            score -= 1;
        }
    }
    return score;
}

function preprocess(text) {
    return text.replace(/[^a-zA-Z\s]/g, '').toLowerCase();
}

function tokenize(text) {
    return text.split(/\s+/);
}

function classifySentiment(text) {
    let score = scoreSentiment(text);
    if (score > 0) {
        return "Positive";
    } else if (score < 0) {
        return "Negative";
    } else {
        return "Neutral";
    }
}


app.post('/scrape', async (req, res) => {
    try {
        const url = req.body.url;
        if (!url) {
            return res.send('URL is required.');
        }

        const browser = await puppeteer.launch({ headless: "new" }).catch(error => console.error("Failed to launch browser:", error));
        if (!browser) return res.send('Failed to launch the browser');
        const page = await browser.newPage();
        await page.goto(url);
        await new Promise(resolve => setTimeout(resolve, 500));

        const content = await page.content();
        const $ = cheerio.load(content);
        const articles = [];

        const articleElements = $('time').toArray();

        for (let element of articleElements) {
            const $element = $(element);

            const baseURL = "https://wsa-test.vercel.app";
            const date = $element.text().trim();
            const type_of_article = $element.next().text().trim();
            const title = $element.parent().next().children().first().text().trim();
            const short_description = $element.parent().next().children().next().text().trim();
            const author = $element.parent().next().next().children().children().first().text().trim();
            const author_proffesion = $element.parent().next().next().children().children().next().text().trim();
            const link = $element.parent().next().find('a').first();
            const linkURL = baseURL + link.attr('href');
            const img = $(element).parent().parent().parent().find('a').find('img');
            const imgURL = baseURL + img.attr('src');


            await page.goto(linkURL, { timeout: 2000 });

            const textFromSecondPage = await page.evaluate((type_of_article) => {

                let divs = Array.from(document.querySelectorAll('div'));
                

                divs = divs.filter(div => {

                    if(div.querySelector('img')) return false;
                    

                    if(div.textContent.includes(type_of_article)) return false;
                    

                    if(div.textContent.includes('Back to Articles')) return false;
                
                    return true;
                });
                

                return divs.map(div => div.innerText.trim().replace(/\n+/g, ' ')).join(' ').trim();
            }, type_of_article);
            
            const wordCount = textFromSecondPage.split(/\s+/).filter(Boolean).length;
            const sentiment = classifySentiment(textFromSecondPage);

            articles.push({ date, title, short_description, author, author_proffesion, linkURL, imgURL, sentiment , type_of_article, wordCount, textFromSecondPage});
        }

        await browser.close();

        saveToFile('articles.txt', articles);

        //console.log('Sending Response:', articles);
        res.json(articles);

    } catch (error) {
        res.status(500).json({ error: 'Failed to scrape content.' });
    }
});

app.get('/download', (req, res) => {
    const file = `${__dirname}/articles.txt`;
    res.download(file);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
