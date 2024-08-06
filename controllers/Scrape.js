const axios = require('axios');
const Groq = require('groq-sdk');
const xml2js = require('xml2js');
const { URL } = require('url');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Function to get AI summary for a given page URL
const main = async (pageUrl) => {
    const chatCompletion = await getGroqChatCompletion(pageUrl);
    return chatCompletion.choices[0]?.message?.content || "";
}

// Function to get AI chat completion from Groq
const getGroqChatCompletion = (pageUrl) => {
    return groq.chat.completions.create({
        messages: [
            {
                role: "user",
                content: `Please summarize the following text into 3-4 bullet points. Each bullet point should be a concise statement and not a paragraph:\n\n${pageUrl}`,
            },
        ],
        model: "llama3-8b-8192",
    });
}

// Function to get and parse robots.txt
async function getRobotsTxt(domain) {
    try {
        const robotsUrl = new URL('/robots.txt', domain).href;
        const response = await axios.get(robotsUrl);
        const robotsTxt = response.data;

        // Extract sitemap URL from robots.txt
        const sitemapUrls = robotsTxt
            .split('\n')
            .filter(line => line.startsWith('Sitemap:'))
            .map(line => line.replace('Sitemap:', '').trim());

        return sitemapUrls.length > 0 ? sitemapUrls[0] : null;
    } catch (error) {
        console.error(`Error fetching robots.txt from ${domain}:`, error);
        throw new Error('Error fetching robots.txt');
    }
}

// Function to parse XML
async function parseXml(xmlData) {
    const parser = new xml2js.Parser();
    return new Promise((resolve, reject) => {
        parser.parseString(xmlData, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// Function to get XML sitemap and parse its content
async function getXml(domain) {
    try {
        // Retrieve and parse robots.txt
        const sitemapUrl = await getRobotsTxt(domain);
        if (!sitemapUrl) {
            throw new Error('Sitemap URL not found in robots.txt');
        }

        // Fetch and parse XML sitemap
        const sitemapResponse = await axios.get(sitemapUrl);
        const sitemapXml = sitemapResponse.data;
        const sitemapResult = await parseXml(sitemapXml);
        
        // Fetch and parse the main XML sitemap URL
        const mainSitemapUrl = sitemapResult.sitemapindex.sitemap[0].loc[0];
        const mainSitemapResponse = await axios.get(mainSitemapUrl);
        const mainSitemapXml = mainSitemapResponse.data;
        const mainSitemapResult = await parseXml(mainSitemapXml);

        // Extract and process products
        const products = mainSitemapResult.urlset.url.slice(0, 5).map(url => ({
            loc: url.loc[0],
            image: url.image ? url.image[0].image[0] : null,
            imageTitle: url.image ? url.image[0].title[0] : null
        }));

        // Fetch AI summaries for each product
        const productsWithSummaries = await Promise.all(products.map(async (product) => {
            const summary = await main(product.loc);
            console.log(summary);
            return {
                ...product,
                data:summary.split('/n')
            };
        }));

        return {
            status: 200,
            message: 'Successfully fetched and parsed XML data',
            data: productsWithSummaries
        };
    } catch (error) {
        console.error('Error fetching or parsing XML:', error);
        return { status: 500, message: 'Error' };
    }
}

exports.getXml = async (req, res) => {
    try {
        const { id } = req.query; 
        if (!id) {
            return res.status(400).json({ message: 'Domain name is required' });
        }
        console.log(id);
        // Ensure the domain is properly formatted
        const formattedDomain = new URL(id).origin;

        const result = await getXml(formattedDomain);

        return res.status(result.status).json({
            message: result.message,
            data: result.data
        });
    } catch (error) {
        console.error('Error in getXml endpoint:', error);
        res.status(500).json({
            message: 'Error'
        });
    }
};
