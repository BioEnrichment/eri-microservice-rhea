
const request = require('request-promise')
const libxmljs = require('libxmljs')
const { Predicates } = require('bioterms')
const crypto = require('crypto')


import { eriToURIs, urisToERI } from 'eri-xrefdb-client'

const rheaUriPrefix = 'https://www.rhea-db.org/rhea/rest/1.0/ws/reaction/cmlreact/'

export async function rhea2sybiont(subject, rheaID) {

    let xml = await request(rheaUriPrefix + rheaID)

    let xmlDoc = libxmljs.parseXml(xml)

    let triples = await processRoot(xmlDoc.root(), subject)

    return triples
}


async function processRoot(node, subject) {

    if(node.name() !== 'reaction')
        throw new Error('expected reaction root tag')

    var triples = []

    var state = { nParticipant: 1 }

    for(let childNode of node.childNodes()) {

        triples = triples.concat(await processTopLevel(childNode, subject, state))

    }

    return triples

}

async function processTopLevel(node, subject, state) {

    let name = node.name()

    var nParticipant = 1

    if(name === 'label') {

        let value = node.attr('value').value()

        if(value === 'Mapped') {

        } else if(value === 'Formuled') {

        } else if(value === 'Chemically balanced') {

        }

        return []

    } else if(name === 'name') {

        return [
            {
                s: subject,
                p: Predicates.Dcterms.title,
                o: node.text(),
                datatype: 'string'
            }
        ]
        
    } else if(name === 'identifier') {

        // value attr RHEA:18529

        return []

    } else if(name === 'reactantList') {

        let triples = []

        for(let childNode of node.childNodes()) {

            if(childNode.name() === 'text')
                continue

            triples = triples.concat(await processReactant(childNode, subject, state.nParticipant))
            ++ state.nParticipant
        }

        return triples

    } else if(name === 'productList') {

        let triples = []

        for(let childNode of node.childNodes()) {

            if(childNode.name() === 'text')
                continue

            triples = triples.concat(await processProduct(childNode, subject, state.nParticipant))
            ++ state.nParticipant
        }

        return triples
        
    } else {

        console.log('Unknown node', name)

        return []

    }

}

// bnodes aren't good for tpf clients
// so would need to give the reactionparticipant a URI
//

async function processReactant(node, s, nParticipant) {

    if(node.name() !== 'reactant')
        throw new Error('expected reactant, got ' + node.name())

    let participantUri = s + '#participant' + nParticipant


    let chebiID = node.get('cml:molecule/cml:identifier', { cml: 'http://www.xml-cml.org/schema/cml2/react' }).attr('value').value()
                    .split(':')[1]

    let chebiURI = 'http://purl.obolibrary.org/obo/CHEBI_' + chebiID

    let compoundERI = await urisToERI([ chebiURI ], 'Compound')

    return [
        { s, p: 'http://w3id.org/synbio/ont#hasReactionParticipant', o: participantUri },
        { s: participantUri, p: 'http://w3id.org/synbio/ont#compound', o: compoundERI },
        { s: participantUri, p: 'http://w3id.org/synbio/ont#reactionSide', o: 'http://w3id.org/synbio/ont#LeftSide' }
    ]

}

async function processProduct(node, s, nParticipant) {

    if(node.name() !== 'product')
        throw new Error('expected product')

    let participantUri = s + '#participant' + nParticipant

    let chebiID = node.get('cml:molecule/cml:identifier', { cml: 'http://www.xml-cml.org/schema/cml2/react' }).attr('value').value()
                    .split(':')[1]

    let chebiURI = 'http://purl.obolibrary.org/obo/CHEBI_' + chebiID

    let compoundERI = await urisToERI([ chebiURI ], 'Compound')

    return [
        { s, p: 'http://w3id.org/synbio/ont#hasReactionParticipant', o: participantUri },
        { s: participantUri, p: 'http://w3id.org/synbio/ont#compound', o: compoundERI },
        { s: participantUri, p: 'http://w3id.org/synbio/ont#reactionSide', o: 'http://w3id.org/synbio/ont#RightSide' }
    ]

}





