# srchr

this is a side-by-side comparison of open source search engines for 30 days of
irc logs from the node.js channel (based on [@izs's logs][logs]). it also
includes search results from google as a baseline. it's a project for my
information retrieval class at university of texas, [inf 384h][ir].

## quickstart

the following has been tested on mac os x and ubuntu.

### pre-requisites

the following must be installed and available on the `$PATH`:

 - [node.js][]
 - [solr][]
 - [sphinx][]
 - [mongodb][]

### launching the app and api servers

 - **download the logs and create the indices:** (this is buggy, try running it
   several times in a row if it doesn't work, especially if you're on a laggy
   university nfs system):

        $ grunt index

 - **start the server:** this launches the respective search engine daemons, a
   restful json api server at port 2999 and app server at 3000.

        $ grunt dev

 - **visit the app server:** at [http://localhost:3000][app] or the api server
   at [htt://localhost:2999][api] if you prefer to look at json.

### working deployment

i've tried deploying this on a utcs machine, and thanks to a really lax
firewall you can go check it out at
[http://adorable-seal-larva.cs.utexas.edu:3000/][deployment] (if it hasn't
crashed or been rebooted).

## more technical information

the project is built on [node.js][], and includes a small single-page web app.
since the project is so io-intensive, the node platform and the [Q][] promise
implementation provided a relatively easy way to orchestrate asynchronous
tasks.

the project uses [grunt][] for task execution, though in retrospect something
more strait-forward such as [npm scripts][] combined with [shelljs][] would
have been more appropriate.

the project remained relatively small, and you can get a feel for the size
using the `grunt cloc` task:

          22 text files.
          22 unique files.
           1 file ignored.

    http://cloc.sourceforge.net v 1.60  T=0.34 s (64.7 files/s, 4866.3 lines/s)
    -------------------------------------------------------------------------------
    Language                     files          blank        comment           code
    -------------------------------------------------------------------------------
    Javascript                      20            198            182           1055
    HTML                             1             12              0            111
    CSS                              1             19              0             77
    -------------------------------------------------------------------------------
    SUM:                            22            229            182           1243
    -------------------------------------------------------------------------------

this project proceeded in 3 main phases:

1. getting the logs up on a public site such that google would index them
2. setting up the open-source search engines to index the same data
3. comparing the results

### the google index

we downloaded [the original logs][logs], which were grouped by day and included
a lot of cruft from the irc client that stored them (code for
[downloading][downloading] and [parsing][parser]).

we then copied them into a directory structure with one file per irc message:

```text
/docs/<year>/<month>/<day>/<hour>_<minute>_<second>_<irc user>.txt
```

the format is important for two reasons:

 - each message lives at a single url, so when google indexes a url, we know it
   corresponds to a single message
 - the url encodes the message metadata (timestamp and sender), so we can
   uniquely identify it

we [posted these files online][one-month] using [github pages][ghpages] for
hosting, so the whole thing is actually a git repository, which you can find
[here][one-month-repo].

we also generated a hierarchical sitemap of all of the messages and used
[google webmaster tools][webmastertools] to monitor the indexing. even without
the webmaster tools login, one can get an estimate of how many pages are
indexed by just [searching for the site][sitesearch]:

> site:http://one-month-of-chat-logs.github.io

we wasted a great deal of time trying to get google to index the full year of
650,000 chat messages. posting the data was difficult, since file systems
struggle with that many small files, but in the end the real problem is getting
google to index all of the documents. that failed attempt is [still
posted][fullyear], but only about half of the site is indexed.

### the other search engines

for each of the other search engines, the repo includes grunt tasks for
indexing the data:

 - [`solr-index`][solr-index]: this is the lucene index
 - [`sphinx-index`][sphinx-index]: this actually executes a sphinx command, but
   the translation into its xml format happens in [`sphinx-xml.js`][sphinx-xml]
 - [`mongo-index`][mongo-index]

these are all brought together with the single (buggy) `grunt index` task. the
engines' daemon processes can then be launched via `grunt {engine}d-start`.

### results comparison

in order to compare the results we first built an api to query against each
engine in parallel. the api is served over http and only supports json
formatting. the [api server][] uses [connect middleware][] for logging, query
string parsing, and error handling. the api server and the search engine
daemons can be launched with `grunt dev`, and then a simple `curl(1)` call
illustrates the format nicely:

```txt
curl http://localhost:2999?q=security
```

and the response:

```json
[
  {
    "engine": "google",
    "docs": [
      {
        "message": "prettyrobots, so security is not concern",
        "handle": "RLa",
        "sent": "2012-07-16T22:35:03.807Z",
        "url": "/docs/2012/7/16/17_35_3_RLa.txt"
      },
      // ... etc ...
    ],
    "duration": 20
  },
  {
    "engine": "solr",
    "docs": [
      {
        "sent": "2012-06-18T05:01:00Z",
        "handle": "Tobsn",
        "message": "machty, not security",
        "url": "/docs/2012/6/18/0_1_0_Tobsn.txt"
      },
      // ... etc ...
    ],
    "ndcg": 0.4278963732209707,
    "rap": 0.8257575757575757,
    "ap": 0.9676989676989677,
    "duration": 31
  },
  {
    "engine": "sphinx",
    // ... etc ...
  },
  // ... etc ...
]
```

the math for the calculations is in the [`lib/math`][math] directory, and the
api server calculates three metrics for each query:

 - [average precision][wikiap]: via [`ap.js`][ap]
 - [r-precision][wikirap]: via [`r-precision.js`][rap]
 - [normalized discounted cumulative gain][wikindcg]: via [`ndcg.js`][ndcg]

we also do full test runs against a [set of queries][searches] using the `grunt
test-run-client` task, giving us mean values for each of the above metrics:

    $ grunt test-run-client
    Running "test-run-client" task
    requesting: http://localhost:2999?q=security
    requesting: http://localhost:2999?q=code
    requesting: http://localhost:2999?q=linux
    requesting: http://localhost:2999?q=node
    requesting: http://localhost:2999?q=github%20issue
    requesting: http://localhost:2999?q=error
    requesting: http://localhost:2999?q=client
    requesting: http://localhost:2999?q=module
    requesting: http://localhost:2999?q=data
    requesting: http://localhost:2999?q=python
    requesting: http://localhost:2999?q=event
    {
      "map": [
        {
          "engine": "solr",
          "map": 0.4007477352242077
        },
        {
          "engine": "mongo",
          "map": 0.1692309524400952
        },
        {
          "engine": "sphinx",
          "map": 0.07373525587514677
        }
      ],
      "mrap": [
        {
          "engine": "solr",
          "mrap": 0.3501094374946722
        },
        {
          "engine": "mongo",
          "mrap": 0.10293738766954828
        },
        {
          "engine": "sphinx",
          "mrap": 0.03222475700897225
        }
      ],
      "mndcg": [
        {
          "engine": "solr",
          "mndcg": 0.4827160290750088
        },
        {
          "engine": "mongo",
          "mndcg": 0.2369124529340672
        },
        {
          "engine": "sphinx",
          "mndcg": 0.16869807478536047
        }
      ]
    }

in all cases, the metrics consistently rank lucene first, followed by mongo,
and then sphinx.

### web app

another important piece of the comparison is viewing individual search results
side-by-side in real time, so we developed a small web app which simply allows
the user to run queries and see the top 10 results from each engine:

![web app screen shot][screenshot]

the app uses a [single-page architecture][spa]; it has a [stripped down
server][app-server] that does little more than serve static resources from the
[`public/`][public] directory and proxy ajax requests to the api server.

the [browser-side code][index.js] provides a simple mvc structure ([model][],
[view][], and the controller just works off of [events][controller]). the app
utilizes [jquery][] for events, ajax, and dom manipulation, and [lodash][] for
utility functions and [templating][]. the app uses [font awesome][] for a
couple icons.

[node.js]: http://nodejs.org
[solr]: http://lucene.apache.org/solr/
[sphinx]: http://sphinxsearch.com
[mongodb]: http://www.mongodb.org
[app]: http://localhost:2999
[api]: htt://localhost:3000
[deployment]: http://adorable-seal-larva.cs.utexas.edu:3000/
[logs]: http://static.izs.me/irclogs/node.js/
[ir]: http://courses.ischool.utexas.edu/Lease_Matt/2013/Fall/CS395T/
[downloading]: https://github.com/aaronj1335/srchr/blob/master/tasks/download-logs.js
[parser]: https://github.com/aaronj1335/srchr/blob/master/lib/parser.js
[one-month]: http://one-month-of-chat-logs.github.io
[one-month-repo]: http://one-month-of-chat-logs.github.io
[ghpages]: http://pages.github.com
[webmastertools]: https://www.google.com/webmasters/tools/home?hl=en
[sitesearch]: https://www.google.com/#q=site:http%3A%2F%2Fone-month-of-chat-logs.github.io
[fullyear]: site:http://one-month-of-chat-logs.github.io
[solr-index]: https://github.com/aaronj1335/srchr/blob/master/tasks/solr-index.js
[sphinx-index]: https://github.com/aaronj1335/srchr/blob/1afe76338db344d3ba26c3c696acfb396e65727b/gruntfile.js#L31
[sphinx-xml]: https://github.com/aaronj1335/srchr/blob/master/tasks/sphinx-xml.js
[mongo-index]: https://github.com/aaronj1335/srchr/blob/master/tasks/mongo-index.js
[Q]: https://github.com/kriskowal/q
[grunt]: http://gruntjs.com
[npm scripts]: https://npmjs.org/doc/misc/npm-scripts.html
[shelljs]: http://documentup.com/arturadib/shelljs
[api server]: https://github.com/aaronj1335/srchr/blob/master/lib/api-server.js
[connect middleware]: http://www.senchalabs.org/connect/
[math]: https://github.com/aaronj1335/srchr/tree/master/lib/math
[wikiap]: http://en.wikipedia.org/wiki/Information_retrieval#Average_precision
[ap]: https://github.com/aaronj1335/srchr/blob/master/lib/math/ap.js
[wikirap]: http://en.wikipedia.org/wiki/Information_retrieval#R-Precision
[rap]: https://github.com/aaronj1335/srchr/blob/master/lib/math/r-precision.js
[wikindcg]: http://en.wikipedia.org/wiki/Discounted_cumulative_gain#Normalized_DCG
[ndcg]: https://github.com/aaronj1335/srchr/blob/master/lib/math/ndcg.js
[searches]: https://github.com/aaronj1335/srchr/blob/master/etc/searches.json
[screenshot]: https://github.com/aaronj1335/srchr/raw/master/etc/web-app-screen-shot.png
[spa]: http://en.wikipedia.org/wiki/Single-page_application
[app-server]: https://github.com/aaronj1335/srchr/blob/master/lib/app-server.js
[public]: https://github.com/aaronj1335/srchr/tree/master/public
[jquery]: http://jquery.com
[lodash]: http://lodash.com
[index.js]: https://github.com/aaronj1335/srchr/blob/master/public/js/index.js
[model]: https://github.com/aaronj1335/srchr/blob/7cbcca6724a028ad1caa54f245a594de08c9b3fd/public/js/index.js#L5
[view]: https://github.com/aaronj1335/srchr/blob/7cbcca6724a028ad1caa54f245a594de08c9b3fd/public/js/index.js#L71
[controller]: https://github.com/aaronj1335/srchr/blob/7cbcca6724a028ad1caa54f245a594de08c9b3fd/public/js/index.js#L150
[templating]: https://github.com/aaronj1335/srchr/blob/7cbcca6724a028ad1caa54f245a594de08c9b3fd/public/index.html#L23
[font awesome]: http://fontawesome.io
