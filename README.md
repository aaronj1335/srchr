# srchr

side-by-side comparison of open source search engines for 30 days of irc logs
from the node.js channel (based on [@izs's logs][logs])

## quickstart

the following has been tested on mac os x and ubuntu.

### pre-requisites

the following must be installed and available on the `$PATH`:

 - [node.js][]
 - [solr][]
 - [sphinx][]

### launching the app and api servers

 - **download the logs and create the indices:** (this is buggy, try running it
   several times in a row if it doesn't work, especially if you're on a crappy
   university nfs system):

        $ grunt index

 - **start the server:** this launches the restful json api server at port 2999
   and app server at 3000.

        $ grunt dev

 - **visit the app server:** at [http://localhost:2999][app] or the api server
   at [htt://localhost:3000][api]

## deployment

i've tried deploying this on a utcs machine, and thanks to a really lax
firewall you can go check it out at
[http://adorable-seal-larva.cs.utexas.edu:3000/][deployment] (if it hasn't
crashed or been rebooted).

[node.js]: http://nodejs.org
[solr]: http://lucene.apache.org/solr/
[sphinx]: http://sphinxsearch.com
[app]: http://localhost:2999
[api]: htt://localhost:3000
[deployment]: http://adorable-seal-larva.cs.utexas.edu:3000/
[logs]: http://static.izs.me/irclogs/node.js/
