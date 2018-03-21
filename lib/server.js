
import LDFServer, { BOUND, UNBOUND } from 'ldf-facade'

import bodyParser from 'body-parser'

import getConfig from 'eri-config'
import { eriToURIs, urisToERI } from 'eri-xrefdb-client'

import request from 'request-promise'


const uniprotPrefix = 'http://www.uniprot.org/uniprot/'

const rheaUrl = 'http://www.rhea-db.org/rest/1.0/ws'

import libxmljs from 'libxmljs'


const rheaUriPrefix = 'https://www.rhea-db.org/rhea/rest/1.0/ws/reaction/cmlreact/'


import { rhea2sybiont } from './rhea2sybiont'

const server = new LDFServer()


/* Add a custom getXRefs endpoint (part of enrichment but not part of the
 * default LDF server)
 */
server.app.post('/getXRefs', bodyParser.json(), async (req, res) => {

    let uris = req.body.uris

	res.send(JSON.stringify({
		uris: uris
	}))
})



/* <uri> ?p ?o
 * Describe a subject
 */
server.pattern({

    s: BOUND,
    p: UNBOUND,
    o: UNBOUND

}, async (state, pattern) => {

	const config = getConfig()

    /* If we are looking for an enrichment URI
     */
	if(pattern.s.indexOf(config.eriPrefix) === 0) {

        /* Get the URIs that this enrichment URI represents (xrefs)
         * We are looking for a RHEA reaction URI.
         */

        let mainSubject = pattern.s.split('#')[0]

        let uris = await eriToURIs(mainSubject)

        for(let uri of uris) {

            if(uri.indexOf(rheaUriPrefix) === 0) {

                let rheaID = uri.slice(rheaUriPrefix.length)

                let triples = await rhea2sybiont(mainSubject, rheaID) 

                // filter for the actual subject requested (might be a #participant or sth)
                //
                triples = triples.filter((triple) => triple.s === pattern.s)

                return { triples, total: triples.length, nextState: null }
            }

        }

        return { total: 0 }

	} else {

        return { total: 0 }

    }


})





/* ?s <uri> <uri>
 * Find a subject with a specific value for a specific property
 */
server.pattern({

    s: UNBOUND,
    p: BOUND,
    o: BOUND

}, async (state, pattern) => {

	const config = getConfig()

    if(pattern.p === 'http://foo/isCatalyzedBy') {

        if(pattern.o.indexOf(config.eriPrefix) !== 0)
            return

        let uniprotAccession = await eriToUniprotAccession(pattern.o)

        let reactions = await findReactions(uniprotAccession)

        let reactionERIs = await Promise.all(
            reactions.map((reaction) => urisToERI([ reaction ], 'Reaction'))
        )

        let triples = reactionERIs.map((eri) => {

            return {
                s: eri,
                p: 'http://foo/isCatalyzedBy',
                o: pattern.o
            }

        })

        return { triples, total: triples.length, nextState: null }

    }

})

async function findReactions(uniprotAccession) {

    let xml = await request({
        method: 'get',
        url: rheaUrl + '/reaction/cmlreact', 
        qs: {
            q: uniprotAccession
        }
    })

    let xmlDoc = libxmljs.parseXml(xml)

    let resultset = xmlDoc.find('//resultset')[0]

    let numRecordsMatched = parseInt(resultset.attr('numberofrecordsmatched').value())
    let numRecordsReturned = parseInt(resultset.attr('numberofrecordsreturned').value())

    let reactions = []

    for(let reaction of resultset.find('rheaReaction')) {
        reactions.push(reaction.get('rheaid/rheaUri/uri').text())
    }

    return reactions
}

server.listen(9875)



async function eriToUniprotAccession(eri) {

    const uris = await eriToURIs(eri)

    if(uris.length === 0) {
        return null
    }

    for(let uri of uris) {

        if(uri.indexOf(uniprotPrefix) === 0) {

            return uri.slice(uniprotPrefix.length)

        }
    }


    return null

}
