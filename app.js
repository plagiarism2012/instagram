const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.avi', '.wmv', '.mov'];

const downloadMedia = async (url) => {
  const response = await axios.get(url, { responseType: 'stream' });
  var extension = "";
  mediaExtensions.forEach(element=>{
    if(url.includes(element) && extension==""){
        extension = element;
    }
  });
  if (mediaExtensions.includes(extension)) {
    const filename = `media${extension}`;
    response.data.pipe(fs.createWriteStream(filename));
  } else {
    console.log(`Skipping ${url} (not a media file)`);
  }
}

// for instagram
app.get('/media', async (req, res) => {
    const requ = {
        "url": req.body.url
    }
    try {
        const url = req.body.url;
        const response = await axios.post("https://dowmate.com/api/allinone/", requ);
        console.log(response.data);
        res.send(response.data);
    } catch (err) {
        res.send({ message: err });
    }
});

// for reddit
app.post('/reddit', async (req, res) => {
    const puppeteer = require('puppeteer');
    (async () => {
        //Launch new browser
        const browser = await puppeteer.launch({
            headless: false
        });
        //Go to the link of the reddit page
        const page = await browser.newPage();
        //URL is in format: https://www.reddit.com/r/[subreddit]/comments/[unique post identifier]/[title]/...we'll parse the url for that unique post identifier
        let pageurl = req.body.url;
        // console.log(pageurl);
        let postid = parseURL(pageurl);
        // console.log(postid);
        //Go to the reddit page
        await page.goto(pageurl);
        //Get the url from which we can derive the video from
        let vidurl = await page.evaluate((postid) => {
            let theurl = '';
            try {
                theurl = document.querySelectorAll('[id="t3_' + postid + '"]')[1].getElementsByTagName('source')[0].src;
            }
            catch(e) {
                //In case the filler pseudoelement doesn't load, happens sometimes
                theurl = document.querySelectorAll('[id="t3_' + postid + '"]')[0].getElementsByTagName('source')[0].src;
            }
            return theurl;
        }, postid);
        //This base of this url is correct, but not the .m3u8 file it's referencing. We need to change this
        // console.log(vidurl);
        //Here's the new suffix we want on this url
        let urlsuffix = '/DASH_360?source=fallback';
        let lastslash = vidurl.lastIndexOf('/');
        vidurl = vidurl.substring(0, lastslash);
        vidurl += urlsuffix;
        //Now we have the final video url. Simply download it
        // console.log(vidurl);

        const response = await axios.get(vidurl, { responseType: 'stream' });
        const filename = "media.mp4";
        response.data.pipe(fs.createWriteStream(filename));
        await browser.close();
    })();

    //This function parses the reddit url and returns the unique post identifier
    function parseURL(url) {
        let commentsindex = url.indexOf('comments');
        url = url.substring(commentsindex);
        let nextslash = url.indexOf('/');
        url = url.substring(nextslash + 1);
        let id = url.substring(0, url.indexOf('/'));
        return id;
    }

    res.send("lol");
})

app.listen(port, () => {
    console.log('Server is running on port ' + port);
});