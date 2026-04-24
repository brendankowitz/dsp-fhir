#!/usr/bin/env node
// Build the DSP-FHIR IG source package and zip it into public/dsp-fhir-ig.zip.
// The package is intended to be ingested by sushi (fsh-sushi) + the HL7 IG Publisher.
// It is a *draft* — enough to validate, expand profiles, and round-trip a sample Bundle.

import AdmZip from 'adm-zip';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_ZIP = join(ROOT, 'public', 'dsp-fhir-ig.zip');
const STAGE = join(ROOT, '.ig-build');
const VERSION = '0.1.0-draft';
const CANONICAL = 'https://dsp-fhir.org';

function w(relPath, content) {
  const full = join(STAGE, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}
function j(relPath, obj) { w(relPath, obj); }

if (existsSync(STAGE)) rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });

// ---------- README ----------
w('README.md', `# DSP-FHIR Implementation Guide (draft)

**Version:** ${VERSION}
**Canonical:** ${CANONICAL}/ImplementationGuide/dsp-fhir
**FHIR version:** R4 (4.0.1) with R5 cross-version extensions

This package is a **draft** IG source tree generated from the companion site at
<https://brendankowitz.github.io/dsp-fhir/>. It describes how Microsoft's
**Dragon Standard Payload (DSP) 1.0** maps onto HL7 FHIR so DSP data becomes
first-class FHIR content — with \`$graphql\` as the preferred read contract.

> **Status:** draft / exploratory. Not an HL7 ballot artifact. Not affiliated with
> Microsoft or Nuance. Provided for evaluation and discussion.

## Contents

\`\`\`
sushi-config.yaml           # FSH publisher config
ig.ini                      # IG Publisher entry point
input/
  fsh/                      # FSH sources (profiles, extensions, logical models, VS/CS)
  resources/                # Hand-authored JSON (CapabilityStatement, OperationDefinition)
  maps/                     # FHIR Mapping Language (FML) skeletons — DSP <-> FHIR
  pagecontent/              # Narrative pages (md)
  examples/                 # Example Bundles + canonical $graphql query
\`\`\`

## Build locally

\`\`\`bash
npm install -g fsh-sushi
sushi .

# Download: https://github.com/HL7/fhir-ig-publisher/releases/latest
java -jar publisher.jar -ig ig.ini
\`\`\`

## Executable mapping (optional)

FML sources in \`input/maps/\` are skeletons that demonstrate the DSP→FHIR
transformation pattern against the DSP logical models. Compile with sushi or
the HL7 FHIR Mapping Language compiler, then execute via \`$transform\` on a
matchbox / HAPI server. See \`input/pagecontent/fml-strategy.md\`.

## The normative four

1. **R1** — Transcript turn-index stability within \`DocumentReference.meta.versionId\`.
2. **R2** — Recording content bound to issuing server's \`Binary\` endpoint.
3. **R3** — \`payload-version\` negotiation advertised in \`CapabilityStatement\`.
4. **R4** — \`Provenance\` per ingest, targeting all touched resources.

See \`input/pagecontent/normative-rules.md\`.

## License

Draft under CC0. FHIR artifacts subject to HL7 license terms. "Dragon",
"Dragon Copilot", and "DSP" are Microsoft/Nuance trademarks; this IG is not
endorsed by either.
`);

// ---------- ig.ini + sushi-config ----------
w('ig.ini', `[IG]
ig = fsh-generated/resources/ImplementationGuide-dsp-fhir.json
template = hl7.fhir.template#current
`);

w('sushi-config.yaml', `id: dsp.fhir
canonical: ${CANONICAL}
version: ${VERSION}
name: DspFhir
title: "DSP-FHIR Implementation Guide (draft)"
status: draft
publisher:
  name: DSP-FHIR community draft
  url: https://brendankowitz.github.io/dsp-fhir/
description: >-
  Draft IG mapping Microsoft's Dragon Standard Payload (DSP) 1.0 onto HL7
  FHIR R4 (with R5 cross-version extensions). Establishes \`$graphql\` as the
  canonical read contract, a DSP logical model, and executable FML maps.
license: CC0-1.0
fhirVersion: 4.0.1
copyrightYear: 2025+
releaseLabel: draft
dependencies:
  hl7.fhir.us.core: 7.0.0
  hl7.fhir.uv.extensions.r5: 5.1.0
  hl7.fhir.uv.xver-r5.r4: 0.1.0-snapshot
parameters:
  show-inherited-invariants: "false"
  apply-contact: "true"
  apply-jurisdiction: "true"
pages:
  index.md: { title: Home }
  background.md: { title: Background — DSP 1.0 }
  design-decisions.md: { title: Design decisions (R4 vs R5 vs R6) }
  mappings.md: { title: DSP → FHIR mappings }
  graphql.md: { title: Canonical $graphql query }
  fml-strategy.md: { title: FML / StructureMap strategy }
  operations.md: { title: Operations audit }
  normative-rules.md: { title: Normative rules R1–R4 }
  changelog.md: { title: Changelog }
menu:
  Home: index.html
  Background: background.html
  Design: design-decisions.html
  Mappings: mappings.html
  "$graphql": graphql.html
  "FML strategy": fml-strategy.html
  Operations: operations.html
  "Normative rules": normative-rules.html
  "Artifacts": artifacts.html
`);

// ---------- ImplementationGuide JSON ----------
j('input/resources/ImplementationGuide-dsp-fhir.json', {
  resourceType: 'ImplementationGuide',
  id: 'dsp-fhir',
  url: `${CANONICAL}/ImplementationGuide/dsp-fhir`,
  version: VERSION,
  name: 'DspFhir',
  title: 'DSP-FHIR Implementation Guide (draft)',
  status: 'draft',
  experimental: true,
  date: new Date().toISOString().slice(0, 10),
  publisher: 'DSP-FHIR community draft',
  description: "Draft IG mapping Microsoft's Dragon Standard Payload (DSP) 1.0 onto HL7 FHIR R4.",
  packageId: 'dsp.fhir',
  license: 'CC0-1.0',
  fhirVersion: ['4.0.1'],
  dependsOn: [
    { uri: 'http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core', packageId: 'hl7.fhir.us.core', version: '7.0.0' },
    { uri: 'http://hl7.org/fhir/extensions/ImplementationGuide/hl7.fhir.uv.extensions.r5', packageId: 'hl7.fhir.uv.extensions.r5', version: '5.1.0' },
    { uri: 'http://hl7.org/fhir/uv/xver/ImplementationGuide/hl7.fhir.uv.xver-r5.r4', packageId: 'hl7.fhir.uv.xver-r5.r4', version: '0.1.0-snapshot' }
  ],
  definition: {
    resource: [],
    page: {
      nameUrl: 'toc.html', title: 'Table of Contents', generation: 'html',
      page: [
        { nameUrl: 'index.html', title: 'Home', generation: 'markdown' },
        { nameUrl: 'background.html', title: 'Background', generation: 'markdown' },
        { nameUrl: 'design-decisions.html', title: 'Design decisions', generation: 'markdown' },
        { nameUrl: 'mappings.html', title: 'Mappings', generation: 'markdown' },
        { nameUrl: 'graphql.html', title: '$graphql', generation: 'markdown' },
        { nameUrl: 'fml-strategy.html', title: 'FML strategy', generation: 'markdown' },
        { nameUrl: 'operations.html', title: 'Operations', generation: 'markdown' },
        { nameUrl: 'normative-rules.html', title: 'Normative rules', generation: 'markdown' }
      ]
    }
  }
});

// ---------- FSH: extensions ----------
w('input/fsh/extensions.fsh', `// DSP-FHIR extensions. Canonical root: ${CANONICAL}/StructureDefinition/

Extension: DspConfidenceScore
Id: dsp-confidence-score
Title: "DSP confidence score"
Description: "0..1 model confidence for a resource or element derived from a Dragon Copilot transcript."
* ^context.type = #element
* ^context.expression = "Element"
* value[x] only decimal
* valueDecimal 1..1
* valueDecimal ^minValueDecimal = 0.0
* valueDecimal ^maxValueDecimal = 1.0

Extension: DspTranscriptTurnRefs
Id: dsp-transcript-turn-refs
Title: "Transcript turn references"
Description: "Turn indices within a DocumentReference transcript that justify this resource/element. Immutable within a transcript versionId (R1)."
* ^context.type = #element
* ^context.expression = "Element"
* extension contains turn 1..* and transcript 0..1
* extension[turn].value[x] only integer
* extension[transcript].value[x] only Reference(DocumentReference)

Extension: DspSpokenForms
Id: dsp-spoken-forms
Title: "Spoken forms"
Description: "Verbatim phrases captured by Dragon Copilot (pre-normalisation)."
* ^context.type = #element
* ^context.expression = "Element"
* value[x] only string

Extension: DspPayloadVersion
Id: dsp-payload-version
Title: "DSP payload version"
* ^context[0].type = #element
* ^context[0].expression = "Encounter"
* ^context[+].type = #element
* ^context[=].expression = "Bundle"
* extension contains major 1..1 and minor 1..1 and revision 0..1 and quality 0..1 and metadata 0..*
* extension[major].value[x] only integer
* extension[minor].value[x] only integer
* extension[revision].value[x] only integer
* extension[quality].value[x] only code
* extension[quality].valueCode from DspPayloadQuality (required)
* extension[metadata].extension contains key 1..1 and value 1..1
* extension[metadata].extension[key].value[x] only string
* extension[metadata].extension[value].value[x] only string

Extension: DspExternalCallbackUrl
Id: dsp-external-callback-url
Title: "External callback URL"
* ^context.type = #element
* ^context.expression = "Encounter"
* value[x] only url

Extension: DspRecordingLocale
Id: dsp-recording-locale
Title: "Recording locale"
* ^context.type = #element
* ^context.expression = "Encounter"
* value[x] only code

Extension: DspTimezone
Id: dsp-timezone
Title: "Encounter timezone (IANA)"
* ^context.type = #element
* ^context.expression = "Encounter"
* value[x] only string

Extension: DspImagingModality
Id: dsp-imaging-modality
Title: "Imaging modality"
* ^context.type = #element
* ^context.expression = "ServiceRequest"
* value[x] only CodeableConcept

Extension: DspImagingViews
Id: dsp-imaging-views
Title: "Imaging views"
* ^context.type = #element
* ^context.expression = "ServiceRequest"
* value[x] only string

Extension: DspImagingContrast
Id: dsp-imaging-contrast
Title: "Imaging contrast"
* ^context.type = #element
* ^context.expression = "ServiceRequest"
* value[x] only code

Extension: DspBodysiteLaterality
Id: dsp-bodysite-laterality
Title: "Body site laterality"
* ^context.type = #element
* ^context.expression = "CodeableConcept"
* value[x] only code

Extension: DspReturnIn
Id: dsp-return-in
Title: "Return-in duration (follow-up)"
* ^context.type = #element
* ^context.expression = "ServiceRequest"
* value[x] only Duration

Extension: DspApproximation
Id: dsp-approximation
Title: "Approximation marker"
* ^context.type = #element
* ^context.expression = "Duration"
* value[x] only boolean

Extension: DspPrn
Id: dsp-prn
Title: "PRN (as needed)"
* ^context.type = #element
* ^context.expression = "ServiceRequest"
* value[x] only boolean

Extension: DspProcedureDevices
Id: dsp-procedure-devices
Title: "Procedure devices (free-text)"
* ^context.type = #element
* ^context.expression = "ServiceRequest"
* value[x] only string

Extension: DspAbbreviation
Id: dsp-abbreviation
Title: "Lab/order abbreviation"
* ^context.type = #element
* ^context.expression = "ServiceRequest"
* value[x] only string

Extension: DspRenderedDosageInstruction
Id: dsp-rendered-dosage-instruction
Title: "Rendered dosage instruction (R5 cross-version)"
* ^context.type = #element
* ^context.expression = "MedicationRequest"
* value[x] only string

Extension: DspConceptId
Id: dsp-concept-id
Title: "Dragon internal concept identifier"
* ^context.type = #element
* ^context.expression = "CodeableConcept"
* value[x] only string

Extension: DspAssertionCategory
Id: dsp-assertion-category
Title: "Clinical assertion category"
* ^context.type = #element
* ^context.expression = "Condition"
* value[x] only code
* valueCode from DspAssertionCategory (required)

Extension: DspLinkageConfidence
Id: dsp-linkage-confidence
Title: "Linkage confidence"
* ^context.type = #element
* ^context.expression = "Element"
* extension contains score 1..1 and level 0..1
* extension[score].value[x] only decimal
* extension[level].value[x] only code

Extension: DspRecordingSource
Id: dsp-recording-source
Title: "Recording source"
* ^context.type = #element
* ^context.expression = "Media"
* value[x] only code
* valueCode from DspRecordingSource (required)

Extension: DspResourceSource
Id: dsp-resource-source
Title: "DSP resource source"
* ^context.type = #element
* ^context.expression = "Resource"
* value[x] only code
* valueCode from DspResourceSource (required)

Extension: DspSpeakerCount
Id: dsp-speaker-count
Title: "Speaker count"
* ^context.type = #element
* ^context.expression = "DocumentReference"
* value[x] only positiveInt

Extension: DspPayloadVersionsAdvert
Id: dsp-payload-versions
Title: "DSP payload versions advertised"
Description: "CapabilityStatement.rest-level extension declaring accepted and emitted payload-version values (R3)."
* ^context.type = #element
* ^context.expression = "CapabilityStatement.rest"
* extension contains accepted 1..* and emitted 1..*
* extension[accepted].value[x] only string
* extension[emitted].value[x] only string
`);

// ---------- FSH: terminology ----------
w('input/fsh/terminology.fsh', `CodeSystem: DspPayloadQualityCS
Id: dsp-payload-quality
Title: "DSP payload quality"
* ^caseSensitive = true
* #complete "Complete"
* #partial "Partial"
* #unavailable "Unavailable"
* #pending "Pending"
* #error "Error"

ValueSet: DspPayloadQuality
Id: dsp-payload-quality-vs
Title: "DSP payload quality"
* include codes from system DspPayloadQualityCS

CodeSystem: DspAssertionCategoryCS
Id: dsp-assertion-category
Title: "DSP assertion category"
* ^caseSensitive = true
* #asserted "Asserted"
* #denied "Denied / Negated"
* #unknown "Unknown"
* #suspected "Suspected"
* #history "Historical"

ValueSet: DspAssertionCategory
Id: dsp-assertion-category-vs
Title: "DSP assertion category"
* include codes from system DspAssertionCategoryCS

CodeSystem: DspRecordingSourceCS
Id: dsp-recording-source
Title: "DSP recording source"
* ^caseSensitive = true
* #DAXAPP "Dragon Copilot mobile app"
* #"DAXKIT.haiku" "DAX Kit via Epic Haiku"
* #"DAXKIT.teams" "DAX Kit via Microsoft Teams"
* #PMM "Dragon Professional / Medical Mobile"

ValueSet: DspRecordingSource
Id: dsp-recording-source-vs
Title: "DSP recording source"
* include codes from system DspRecordingSourceCS

CodeSystem: DspResourceSourceCS
Id: dsp-resource-source
Title: "DSP resource source"
* ^caseSensitive = true
* #dragon_copilot "Dragon Copilot"
* #ehr_integration "EHR integration"
* #extension "Extension / third-party"

ValueSet: DspResourceSource
Id: dsp-resource-source-vs
Title: "DSP resource source"
* include codes from system DspResourceSourceCS

CodeSystem: DspOrderCategoryCS
Id: dsp-order-category
Title: "DSP order category"
* ^caseSensitive = true
* #follow-up "Follow-up"
* #referral "Referral"
* #therapy "Therapy"
* #activity "Activity"
* #study "Study"

ValueSet: DspOrderCategory
Id: dsp-order-category-vs
Title: "DSP order category"
* include codes from system DspOrderCategoryCS

ValueSet: DspDocumentSection
Id: dsp-document-section-vs
Title: "DSP document section"
* LOINC#51855-5 "Patient note"
* LOINC#8648-8 "Hospital course Narrative"
* LOINC#10164-2 "History of Present illness Narrative"
* LOINC#10187-3 "Review of systems Narrative"
* LOINC#11348-0 "History of Past illness Narrative"
* LOINC#10160-0 "History of Medication use Narrative"
* LOINC#48765-2 "Allergies and adverse reactions Document"
* LOINC#29545-1 "Physical findings Narrative"
* LOINC#51847-2 "Evaluation + Plan note"
* LOINC#18776-5 "Plan of care note"
`);

// ---------- FSH: DSP logical models ----------
w('input/fsh/logical-models.fsh', `// DSP 1.0 logical models. These describe the DSP JSON shape as FHIR
// StructureDefinitions (kind = logical), enabling $validate on incoming DSP
// payloads and serving as the source side for FML maps.

Logical: DspPayload
Id: DspPayload
Title: "DSP payload envelope (logical)"
Description: "Root DSP 1.0 payload delivered to partners. Mirrors Microsoft's Dragon Standard Payload JSON envelope."
* ^url = "${CANONICAL}/StructureDefinition/DspPayload"
* payload_version 1..1 BackboneElement "Payload version" "Structured version object (major/minor/revision/quality/metadata)."
* payload_version.major 1..1 integer "Major"
* payload_version.minor 1..1 integer "Minor"
* payload_version.revision 0..1 integer "Revision"
* payload_version.quality 0..1 code "Quality" "complete | partial | unavailable | pending | error"
* payload_version.metadata 0..* BackboneElement "Free-form KV metadata"
* payload_version.metadata.key 1..1 string "Key"
* payload_version.metadata.value 1..1 string "Value"
* context 1..1 DspContext "Encounter / session context"
* transcript 0..1 DspTranscript "Transcript"
* recording 0..* DspRecording "Audio/video recordings"
* resources 0..* DspResource "Clinical resources"

Logical: DspContext
Id: DspContext
Title: "DSP context (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspContext"
* patient 1..1 BackboneElement "Patient identity"
* patient.mrn 0..1 string "Medical record number"
* patient.name 0..1 string "Display name"
* patient.gender 0..1 code
* patient.birth_date 0..1 date
* encounter 1..1 BackboneElement
* encounter.start 0..1 dateTime
* encounter.end 0..1 dateTime
* encounter.timezone 0..1 string "IANA timezone"
* encounter.locale 0..1 code
* encounter.class 0..1 code
* participants 0..* BackboneElement "Participants (clinicians, etc.)"
* participants.role 1..1 code "clinician | patient | other"
* participants.name 0..1 string
* participants.npi 0..1 string
* external_callback_url 0..1 url

Logical: DspTranscript
Id: DspTranscript
Title: "DSP transcript (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspTranscript"
* turns 1..* BackboneElement "Speaker-turned utterances. Turn indices are immutable within a transcript version (R1)."
* turns.index 1..1 integer
* turns.speaker 0..1 string
* turns.speaker_role 0..1 code "clinician | patient | other"
* turns.text 1..1 string
* turns.start_offset_ms 0..1 integer
* turns.end_offset_ms 0..1 integer
* speaker_count 0..1 positiveInt

Logical: DspRecording
Id: DspRecording
Title: "DSP recording (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspRecording"
* source 1..1 code "DAXAPP | DAXKIT.haiku | DAXKIT.teams | PMM"
* content_type 1..1 code "MIME type"
* url 1..1 url "Access URL (signed)"
* start 0..1 dateTime
* duration_ms 0..1 integer

Logical: DspResource
Id: DspResource
Title: "DSP clinical resource (logical)"
Description: "Common envelope for all DSP clinical resources. Narrowed by content_type."
* ^url = "${CANONICAL}/StructureDefinition/DspResource"
* id 1..1 string
* content_type 1..1 code "document_section | condition | order.{type}"
* source 0..1 code "dragon_copilot | ehr_integration | extension"
* confidence 0..1 decimal
* transcript_turn_refs 0..* integer
* spoken_forms 0..* string
* payload 1..1 BackboneElement "Type-specific payload; see per-content_type logical models."

Logical: DspConditionResource
Id: DspConditionResource
Parent: DspResource
Title: "DSP condition resource (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspConditionResource"
* payload.code 0..1 string "Normalized code"
* payload.code_system 0..1 uri
* payload.display 1..1 string
* payload.assertion 1..1 code "asserted | denied | unknown | suspected | history"
* payload.concept_id 0..1 string "Dragon internal concept id"
* payload.onset_text 0..1 string

Logical: DspOrderMedicationResource
Id: DspOrderMedicationResource
Parent: DspResource
Title: "DSP medication order (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspOrderMedicationResource"
* payload.drug 1..1 string "Free text drug name"
* payload.rxnorm_code 0..1 string
* payload.rendered_dosage_instruction 0..1 string "Full sig as spoken/rendered"
* payload.dose_quantity 0..1 string
* payload.route 0..1 string
* payload.frequency 0..1 string
* payload.prn 0..1 boolean

Logical: DspOrderImagingResource
Id: DspOrderImagingResource
Parent: DspResource
Title: "DSP imaging order (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspOrderImagingResource"
* payload.modality 1..1 string
* payload.body_site 0..1 string
* payload.laterality 0..1 code
* payload.contrast 0..1 code
* payload.views 0..* string

Logical: DspOrderLabResource
Id: DspOrderLabResource
Parent: DspResource
Title: "DSP lab order (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspOrderLabResource"
* payload.test 1..1 string
* payload.loinc 0..1 string
* payload.abbreviation 0..1 string

Logical: DspOrderFollowUpResource
Id: DspOrderFollowUpResource
Parent: DspResource
Title: "DSP follow-up order (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspOrderFollowUpResource"
* payload.return_in_value 0..1 integer
* payload.return_in_unit 0..1 code "d | wk | mo | yr"
* payload.approximation 0..1 boolean
* payload.reason 0..1 string
* payload.prn 0..1 boolean

Logical: DspDocumentSectionResource
Id: DspDocumentSectionResource
Parent: DspResource
Title: "DSP document section (logical)"
* ^url = "${CANONICAL}/StructureDefinition/DspDocumentSectionResource"
* payload.section_type 1..1 string "LOINC or DSP-defined section code"
* payload.title 0..1 string
* payload.text 1..1 string "Narrative (markdown or plain)"
`);

// ---------- FSH: profiles (compressed — one file) ----------
w('input/fsh/profiles.fsh', `// Patient / Practitioner / Encounter
Profile: DspPatient
Parent: USCorePatientProfile
Id: DspPatient
Title: "DSP Patient"
* identifier 1..*

Profile: DspPractitioner
Parent: USCorePractitionerProfile
Id: DspPractitioner
Title: "DSP Practitioner"
* identifier contains npi 0..1
* identifier[npi].system = "http://hl7.org/fhir/sid/us-npi"

Profile: DspEncounter
Parent: USCoreEncounterProfile
Id: DspEncounter
Title: "DSP Encounter"
* extension contains
    DspPayloadVersion named payloadVersion 0..1 and
    DspExternalCallbackUrl named callbackUrl 0..1 and
    DspRecordingLocale named locale 0..1 and
    DspTimezone named tz 0..1

// Composition / DocumentReference
Profile: DspComposition
Parent: Composition
Id: DspComposition
Title: "DSP Composition"
* type 1..1
* subject only Reference(DspPatient)
* encounter only Reference(DspEncounter)
* section.code from DspDocumentSection (extensible)
* section.extension contains DspSpokenForms named spokenForms 0..*

Profile: DspDocumentReferenceTranscript
Parent: DocumentReference
Id: DspDocumentReferenceTranscript
Title: "DSP transcript DocumentReference"
* content 1..*
* content.attachment.contentType = "application/json"
* extension contains DspSpeakerCount named speakers 0..1

// Condition
Profile: DspCondition
Parent: USCoreConditionProblemsHealthConcernsProfile
Id: DspCondition
Title: "DSP Condition"
* extension contains
    DspAssertionCategory named assertion 0..1 and
    DspConfidenceScore named confidence 0..1 and
    DspTranscriptTurnRefs named turnRefs 0..1 and
    DspSpokenForms named spokenForms 0..* and
    DspResourceSource named source 0..1
* code.extension contains DspConceptId named conceptId 0..1

// Orders
Profile: DspMedicationRequest
Parent: USCoreMedicationRequestProfile
Id: DspMedicationRequest
Title: "DSP MedicationRequest"
* extension contains
    DspRenderedDosageInstruction named rendered 0..1 and
    DspConfidenceScore named confidence 0..1 and
    DspTranscriptTurnRefs named turnRefs 0..1

Profile: DspServiceRequestLab
Parent: USCoreServiceRequestProfile
Id: DspServiceRequestLab
Title: "DSP ServiceRequest (lab)"
* extension contains DspAbbreviation named abbrev 0..1

Profile: DspServiceRequestImaging
Parent: ServiceRequest
Id: DspServiceRequestImaging
Title: "DSP ServiceRequest (imaging)"
* extension contains
    DspImagingModality named modality 0..1 and
    DspImagingViews named views 0..* and
    DspImagingContrast named contrast 0..1
* bodySite.extension contains DspBodysiteLaterality named laterality 0..1

Profile: DspServiceRequestProcedure
Parent: ServiceRequest
Id: DspServiceRequestProcedure
Title: "DSP ServiceRequest (procedure)"
* extension contains DspProcedureDevices named devices 0..*

Profile: DspServiceRequestReferral
Parent: ServiceRequest
Id: DspServiceRequestReferral
Title: "DSP ServiceRequest (referral)"
* performerType 0..1

Profile: DspServiceRequestFollowUp
Parent: ServiceRequest
Id: DspServiceRequestFollowUp
Title: "DSP ServiceRequest (follow-up)"
* extension contains
    DspReturnIn named returnIn 0..1 and
    DspPrn named prn 0..1

Profile: DspNutritionOrder
Parent: NutritionOrder
Id: DspNutritionOrder
Title: "DSP NutritionOrder"

Profile: DspImmunizationRecommendation
Parent: ImmunizationRecommendation
Id: DspImmunizationRecommendation
Title: "DSP ImmunizationRecommendation (no administration evidence)"

Profile: DspImmunization
Parent: USCoreImmunizationProfile
Id: DspImmunization
Title: "DSP Immunization (administration evidence present)"

Profile: DspDeviceRequest
Parent: DeviceRequest
Id: DspDeviceRequest
Title: "DSP DeviceRequest"

Profile: DspServiceRequestTherapy
Parent: ServiceRequest
Id: DspServiceRequestTherapy
Title: "DSP ServiceRequest (therapy)"

Profile: DspCarePlan
Parent: CarePlan
Id: DspCarePlan
Title: "DSP CarePlan (activity aggregator)"
* activity 1..*

Profile: DspServiceRequestStudy
Parent: ServiceRequest
Id: DspServiceRequestStudy
Title: "DSP ServiceRequest (study — diagnostic intent)"

Profile: DspResearchSubject
Parent: ResearchSubject
Id: DspResearchSubject
Title: "DSP ResearchSubject (study — research enrollment)"

Profile: DspProvenance
Parent: Provenance
Id: DspProvenance
Title: "DSP Provenance (R4 — required per ingest)"
* target 1..*
* entity 1..*
* entity.what only Reference(DspDocumentReferenceTranscript)

Profile: DspMediaRecording
Parent: Media
Id: DspMediaRecording
Title: "DSP Media (audio/video)"
* extension contains DspRecordingSource named source 0..1
* content.url 1..1
`);

// ---------- FML maps ----------
w('input/maps/DspConditionToCondition.map', `// FHIR Mapping Language — DSP condition → FHIR Condition (US Core profile)
// Compile: sushi or fhir-mapping-language compiler
// Execute: POST [fhir-base]/StructureMap/$transform?source=<canonical>
//          with a DspConditionResource instance in the body.

map "${CANONICAL}/StructureMap/DspConditionToCondition" = "DspConditionToCondition"

uses "${CANONICAL}/StructureDefinition/DspConditionResource" alias DspCondition as source
uses "http://hl7.org/fhir/StructureDefinition/Condition" alias Condition as target

group DspConditionToCondition(source src : DspCondition, target tgt : Condition) {
  src.id as id -> tgt.id = id;

  // Code: prefer normalized system+code, else text only
  src.payload as p then {
    p.code as c -> tgt.code as code, code.coding as coding then {
      c -> coding.code = c;
      p.code_system as sys -> coding.system = sys;
      p.display as d -> coding.display = d;
    } "code";
    p.display as d -> tgt.code as code, code.text = d "display-fallback";

    // Assertion category → clinicalStatus + verificationStatus + extension
    p.assertion as a -> tgt.extension as ext then {
      a -> ext.url = '${CANONICAL}/StructureDefinition/dsp-assertion-category',
           ext.value = create('code') as v, v.value = a;
    } "assertion-ext";

    p.assertion as a where (a = 'asserted' or a = 'history') -> tgt.verificationStatus as vs,
      vs.coding as co, co.system = 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
      co.code = 'confirmed' "verif-confirmed";
    p.assertion as a where a = 'denied' -> tgt.verificationStatus as vs,
      vs.coding as co, co.system = 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
      co.code = 'refuted' "verif-refuted";
    p.assertion as a where a = 'suspected' -> tgt.verificationStatus as vs,
      vs.coding as co, co.system = 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
      co.code = 'provisional' "verif-provisional";

    p.concept_id as cid -> tgt.code as code, code.extension as ext then {
      cid -> ext.url = '${CANONICAL}/StructureDefinition/dsp-concept-id',
             ext.value = create('string') as v, v.value = cid;
    } "concept-id";
  };

  // Confidence → extension
  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = '${CANONICAL}/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";

  // Transcript turn refs → extension (turn instances)
  src.transcript_turn_refs as t -> tgt.extension as ext,
    ext.url = '${CANONICAL}/StructureDefinition/dsp-transcript-turn-refs',
    ext.extension as turnExt,
    turnExt.url = 'turn',
    turnExt.value = create('integer') as v, v.value = t "turn-ref";

  // Spoken forms → repeating extension
  src.spoken_forms as sf -> tgt.extension as ext,
    ext.url = '${CANONICAL}/StructureDefinition/dsp-spoken-forms',
    ext.value = create('string') as v, v.value = sf "spoken-form";

  // Default clinicalStatus = active (caller can override post-hoc)
  src -> tgt.clinicalStatus as cs, cs.coding as co,
    co.system = 'http://terminology.hl7.org/CodeSystem/condition-clinical',
    co.code = 'active' "clinical-default";
}
`);

w('input/maps/DspMedicationOrderToMedicationRequest.map', `// FML — DSP order.medication → FHIR MedicationRequest (US Core profile)

map "${CANONICAL}/StructureMap/DspMedicationOrderToMedicationRequest" = "DspMedicationOrderToMedicationRequest"

uses "${CANONICAL}/StructureDefinition/DspOrderMedicationResource" alias DspMedOrder as source
uses "http://hl7.org/fhir/StructureDefinition/MedicationRequest" alias MedicationRequest as target

group DspMedicationOrderToMedicationRequest(source src : DspMedOrder, target tgt : MedicationRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';

  src.payload as p then {
    p.drug as drug -> tgt.medication = create('CodeableConcept') as cc,
      cc.text = drug "drug-text";
    p.rxnorm_code as rx -> tgt.medication as med, med.coding as co,
      co.system = 'http://www.nlm.nih.gov/research/umls/rxnorm', co.code = rx "rxnorm";
    p.rendered_dosage_instruction as rdi -> tgt.extension as ext then {
      rdi -> ext.url = '${CANONICAL}/StructureDefinition/dsp-rendered-dosage-instruction',
             ext.value = create('string') as v, v.value = rdi;
    } "rendered-sig";
    p.rendered_dosage_instruction as rdi -> tgt.dosageInstruction as di, di.text = rdi "sig-text";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = '${CANONICAL}/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";

  src.transcript_turn_refs as t -> tgt.extension as ext,
    ext.url = '${CANONICAL}/StructureDefinition/dsp-transcript-turn-refs',
    ext.extension as turnExt, turnExt.url = 'turn',
    turnExt.value = create('integer') as v, v.value = t "turn-ref";
}
`);

w('input/maps/README.md', `# FML / StructureMap sources

These are **skeleton** FHIR Mapping Language files demonstrating the DSP →
FHIR transformation approach. They are not complete coverage of all 15 DSP
resource types — see \`../pagecontent/fml-strategy.md\` for the phasing.

## Files

| File | Direction | Coverage | Notes |
|---|---|---|---|
| \`DspConditionToCondition.map\` | DSP → FHIR | Complete | Demonstrates assertion-category routing to \`verificationStatus\`, turn-ref / confidence / spoken-forms extension generation. |
| \`DspMedicationOrderToMedicationRequest.map\` | DSP → FHIR | Complete | RxNorm-code resolution, rendered-dosage-instruction carrying via R5 xver extension + literal \`dosageInstruction.text\`. |

## What's intentionally **not** here yet

- **Routing-split mappings** (immunization → Immunization vs
  ImmunizationRecommendation; study → ServiceRequest vs ResearchSubject;
  activity → CarePlan.activity vs standalone ServiceRequest). FML can express
  these with \`where\` clauses on input fields but the condition logic is
  awkward enough that Phase-3 implementations are expected to split upstream
  before invoking the map.
- **Reverse FHIR → DSP maps.** Phase 4.
- **Grounding state (R1).** Cross-version turn-index management is controller
  logic, not mapping. StructureMap is deliberately pure.

## Running against a DSP payload

\`\`\`bash
# With matchbox (Docker):
docker run -p 8080:8080 eu.gcr.io/fhir-ch/matchbox:latest
# PUT each StructureDefinition + StructureMap, then:
curl -X POST http://localhost:8080/fhir/StructureMap/\\$transform \\
  -H 'Content-Type: application/fhir+json' \\
  --data @my-dsp-condition.json
\`\`\`
`);

// ---------- CapabilityStatement ----------
j('input/resources/CapabilityStatement-dsp-server.json', {
  resourceType: 'CapabilityStatement',
  id: 'dsp-server',
  url: `${CANONICAL}/CapabilityStatement/dsp-server`,
  version: VERSION,
  name: 'DspServer',
  title: 'DSP-FHIR server (reference)',
  status: 'draft',
  experimental: true,
  date: new Date().toISOString().slice(0, 10),
  publisher: 'DSP-FHIR community draft',
  kind: 'requirements',
  fhirVersion: '4.0.1',
  format: ['json'],
  implementationGuide: [`${CANONICAL}/ImplementationGuide/dsp-fhir`],
  rest: [{
    mode: 'server',
    documentation: 'DSP-FHIR reference server capabilities.',
    extension: [{
      url: `${CANONICAL}/StructureDefinition/dsp-payload-versions`,
      extension: [
        { url: 'accepted', valueString: '1.0' },
        { url: 'emitted', valueString: '1.0' }
      ]
    }],
    security: { service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'SMART-on-FHIR' }] }] },
    resource: [
      { type: 'Encounter', supportedProfile: [`${CANONICAL}/StructureDefinition/DspEncounter`], interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'update' }], operation: [{ name: 'everything', definition: 'http://hl7.org/fhir/OperationDefinition/Encounter-everything' }, { name: 'graphql', definition: 'http://hl7.org/fhir/OperationDefinition/Resource-graphql' }] },
      { type: 'Patient', supportedProfile: [`${CANONICAL}/StructureDefinition/DspPatient`], interaction: [{ code: 'read' }, { code: 'search-type' }], operation: [{ name: 'match', definition: 'http://hl7.org/fhir/OperationDefinition/Patient-match' }] },
      { type: 'Composition', supportedProfile: [`${CANONICAL}/StructureDefinition/DspComposition`], interaction: [{ code: 'read' }, { code: 'search-type' }], operation: [{ name: 'document', definition: 'http://hl7.org/fhir/OperationDefinition/Composition-document' }] },
      { type: 'DocumentReference', supportedProfile: [`${CANONICAL}/StructureDefinition/DspDocumentReferenceTranscript`], interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'vread' }] },
      { type: 'Condition', supportedProfile: [`${CANONICAL}/StructureDefinition/DspCondition`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'MedicationRequest', supportedProfile: [`${CANONICAL}/StructureDefinition/DspMedicationRequest`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'ServiceRequest', supportedProfile: [
          `${CANONICAL}/StructureDefinition/DspServiceRequestLab`,
          `${CANONICAL}/StructureDefinition/DspServiceRequestImaging`,
          `${CANONICAL}/StructureDefinition/DspServiceRequestProcedure`,
          `${CANONICAL}/StructureDefinition/DspServiceRequestReferral`,
          `${CANONICAL}/StructureDefinition/DspServiceRequestFollowUp`,
          `${CANONICAL}/StructureDefinition/DspServiceRequestTherapy`,
          `${CANONICAL}/StructureDefinition/DspServiceRequestStudy`
        ], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'NutritionOrder', supportedProfile: [`${CANONICAL}/StructureDefinition/DspNutritionOrder`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'Immunization', supportedProfile: [`${CANONICAL}/StructureDefinition/DspImmunization`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'ImmunizationRecommendation', supportedProfile: [`${CANONICAL}/StructureDefinition/DspImmunizationRecommendation`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'DeviceRequest', supportedProfile: [`${CANONICAL}/StructureDefinition/DspDeviceRequest`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'CarePlan', supportedProfile: [`${CANONICAL}/StructureDefinition/DspCarePlan`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'ResearchSubject', supportedProfile: [`${CANONICAL}/StructureDefinition/DspResearchSubject`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'Provenance', supportedProfile: [`${CANONICAL}/StructureDefinition/DspProvenance`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'Media', supportedProfile: [`${CANONICAL}/StructureDefinition/DspMediaRecording`], interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'Binary', interaction: [{ code: 'read' }] },
      { type: 'StructureMap', interaction: [{ code: 'read' }], operation: [{ name: 'transform', definition: 'http://hl7.org/fhir/OperationDefinition/StructureMap-transform' }] }
    ],
    interaction: [{ code: 'transaction' }, { code: 'batch' }, { code: 'search-system' }],
    operation: [
      { name: 'validate', definition: 'http://hl7.org/fhir/OperationDefinition/Resource-validate' },
      { name: 'graphql', definition: 'http://hl7.org/fhir/OperationDefinition/Resource-graphql' },
      { name: 'expand', definition: 'http://hl7.org/fhir/OperationDefinition/ValueSet-expand' },
      { name: 'lookup', definition: 'http://hl7.org/fhir/OperationDefinition/CodeSystem-lookup' },
      { name: 'export', definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/patient-export' },
      { name: 'transform', definition: 'http://hl7.org/fhir/OperationDefinition/StructureMap-transform' },
      { name: 'ground', definition: `${CANONICAL}/OperationDefinition/ground` }
    ]
  }]
});

// ---------- OperationDefinition $ground ----------
j('input/resources/OperationDefinition-ground.json', {
  resourceType: 'OperationDefinition',
  id: 'ground',
  url: `${CANONICAL}/OperationDefinition/ground`,
  version: VERSION,
  name: 'Ground',
  title: 'DSP transcript turn grounding',
  status: 'draft',
  kind: 'operation',
  experimental: true,
  date: new Date().toISOString().slice(0, 10),
  publisher: 'DSP-FHIR community draft',
  description: 'Resolve transcript-turn-refs on one or more resources into their underlying transcript turns (text + speaker + offsets) from the bound DocumentReference version. Read-only.',
  affectsState: false,
  code: 'ground',
  resource: ['Resource'],
  system: false, type: true, instance: true,
  parameter: [
    { name: 'resource', use: 'in', min: 0, max: '*', documentation: 'Resources to ground. If omitted (instance-level), grounds the target.', type: 'Reference' },
    { name: 'transcript', use: 'in', min: 0, max: '1', documentation: 'Override transcript DocumentReference.', type: 'Reference' },
    { name: 'result', use: 'out', min: 1, max: '1', documentation: 'Bundle of Parameters; each entry maps a resource to its grounded turn array.', type: 'Bundle' }
  ]
});

// ---------- Examples ----------
j('input/examples/Bundle-example-visit.json', {
  resourceType: 'Bundle',
  id: 'example-visit',
  type: 'transaction',
  entry: [
    {
      fullUrl: 'urn:uuid:patient-1',
      resource: {
        resourceType: 'Patient',
        meta: { profile: [`${CANONICAL}/StructureDefinition/DspPatient`] },
        identifier: [{ system: 'http://hospital.example.org/mrn', value: 'MRN-12345' }],
        name: [{ family: 'Smith', given: ['Jane'] }],
        gender: 'female', birthDate: '1974-03-12'
      },
      request: { method: 'PUT', url: 'Patient?identifier=http://hospital.example.org/mrn|MRN-12345' }
    },
    {
      fullUrl: 'urn:uuid:encounter-1',
      resource: {
        resourceType: 'Encounter',
        meta: { profile: [`${CANONICAL}/StructureDefinition/DspEncounter`] },
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
        subject: { reference: 'urn:uuid:patient-1' },
        period: { start: '2026-04-24T14:00:00-07:00', end: '2026-04-24T14:22:00-07:00' },
        extension: [
          { url: `${CANONICAL}/StructureDefinition/dsp-payload-version`,
            extension: [
              { url: 'major', valueInteger: 1 },
              { url: 'minor', valueInteger: 0 },
              { url: 'quality', valueCode: 'complete' }
            ] },
          { url: `${CANONICAL}/StructureDefinition/dsp-recording-locale`, valueCode: 'en-US' },
          { url: `${CANONICAL}/StructureDefinition/dsp-timezone`, valueString: 'America/Los_Angeles' }
        ]
      },
      request: { method: 'POST', url: 'Encounter' }
    },
    {
      fullUrl: 'urn:uuid:transcript-1',
      resource: {
        resourceType: 'DocumentReference',
        meta: { profile: [`${CANONICAL}/StructureDefinition/DspDocumentReferenceTranscript`] },
        status: 'current',
        type: { coding: [{ system: 'http://loinc.org', code: '11488-4', display: 'Consult note' }] },
        subject: { reference: 'urn:uuid:patient-1' },
        context: { encounter: [{ reference: 'urn:uuid:encounter-1' }] },
        content: [{ attachment: { contentType: 'application/json', url: 'Binary/transcript-1' } }]
      },
      request: { method: 'POST', url: 'DocumentReference' }
    },
    {
      fullUrl: 'urn:uuid:condition-1',
      resource: {
        resourceType: 'Condition',
        meta: { profile: [`${CANONICAL}/StructureDefinition/DspCondition`] },
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
        code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Diabetes mellitus type 2' }], text: 'T2DM' },
        subject: { reference: 'urn:uuid:patient-1' },
        encounter: { reference: 'urn:uuid:encounter-1' },
        extension: [
          { url: `${CANONICAL}/StructureDefinition/dsp-assertion-category`, valueCode: 'asserted' },
          { url: `${CANONICAL}/StructureDefinition/dsp-confidence-score`, valueDecimal: 0.94 },
          { url: `${CANONICAL}/StructureDefinition/dsp-transcript-turn-refs`,
            extension: [
              { url: 'turn', valueInteger: 7 },
              { url: 'turn', valueInteger: 9 },
              { url: 'transcript', valueReference: { reference: 'urn:uuid:transcript-1' } }
            ] }
        ]
      },
      request: { method: 'POST', url: 'Condition' }
    },
    {
      fullUrl: 'urn:uuid:provenance-1',
      resource: {
        resourceType: 'Provenance',
        meta: { profile: [`${CANONICAL}/StructureDefinition/DspProvenance`] },
        target: [{ reference: 'urn:uuid:condition-1' }, { reference: 'urn:uuid:encounter-1' }],
        recorded: '2026-04-24T14:23:00-07:00',
        activity: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation', code: 'CREATE' }] },
        agent: [{ type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'author' }] }, who: { display: 'Dragon Copilot' } }],
        entity: [{ role: 'source', what: { reference: 'urn:uuid:transcript-1' } }]
      },
      request: { method: 'POST', url: 'Provenance' }
    }
  ]
});

// Example DSP condition instance matching the logical model (what partners POST)
j('input/examples/dsp-condition-input.json', {
  resourceType: 'Basic',
  id: 'dsp-condition-example',
  meta: { profile: [`${CANONICAL}/StructureDefinition/DspConditionResource`] },
  // This is an illustrative DSP payload in a Basic wrapper. Real DSP is raw JSON;
  // servers that support logical-model $validate accept it directly.
  extension: [{
    url: 'http://example.org/raw-dsp',
    valueString: JSON.stringify({
      id: 'dsp-cond-7',
      content_type: 'condition',
      source: 'dragon_copilot',
      confidence: 0.94,
      transcript_turn_refs: [7, 9],
      spoken_forms: ['type 2 diabetes', 'T2DM'],
      payload: {
        code: '44054006',
        code_system: 'http://snomed.info/sct',
        display: 'Diabetes mellitus type 2',
        assertion: 'asserted',
        concept_id: 'DRAGON_CID_00172'
      }
    }, null, 2)
  }]
});

w('input/examples/graphql-encounter-query.txt', `# Canonical DSP read contract — $graphql at Encounter scope.
# POST [fhir-base]/Encounter/{id}/$graphql
# Content-Type: application/json
# Body: { "query": "<below>" }

query DspEncounter($id: ID!) {
  Encounter(id: $id) {
    id
    status
    class { code display }
    period { start end }
    subject { resource { ... on Patient { id identifier { system value } name { family given } } } }
    extension(url: "${CANONICAL}/StructureDefinition/dsp-payload-version") {
      extension { url valueInteger valueCode valueString }
    }
    Composition: _revinclude(type: "Composition", field: "encounter") {
      id
      type { coding { system code display } }
      section { title code { coding { system code display } } text { status div } }
    }
    Condition: _revinclude(type: "Condition", field: "encounter") {
      id
      code { coding { system code display } text }
      clinicalStatus { coding { code } }
      extension(url: "${CANONICAL}/StructureDefinition/dsp-confidence-score") { valueDecimal }
      extension(url: "${CANONICAL}/StructureDefinition/dsp-transcript-turn-refs") {
        extension { url valueInteger valueReference { reference } }
      }
    }
    MedicationRequest: _revinclude(type: "MedicationRequest", field: "encounter") {
      id medicationCodeableConcept { coding { system code display } text } dosageInstruction { text }
    }
    ServiceRequest: _revinclude(type: "ServiceRequest", field: "encounter") {
      id category { coding { system code display } } code { coding { system code display } text }
    }
  }
}
`);

// ---------- Markdown pages ----------
w('input/pagecontent/index.md', `# DSP-FHIR IG (draft ${VERSION})

> Draft IG authored outside HL7 to explore how
> [Dragon Standard Payload (DSP) 1.0](https://learn.microsoft.com/en-us/industry/healthcare/dragon-copilot/sdk/partner-apis/dragon-data-exchange/dragon-standard-payload/)
> maps onto HL7 FHIR. Not affiliated with Microsoft/Nuance; not balloted.

## What's in this IG

- **DSP logical models** (kind=logical StructureDefinitions) describing the DSP
  JSON shape in FHIR-native terms, enabling \`$validate\` against incoming DSP
  payloads before transformation.
- **Profiles** on R4 resources for every DSP content_type (15 types incl. 10 order subtypes).
- **Extensions** for DSP semantics with no natural FHIR home (turn refs,
  confidence, payload-version, assertion category, spoken forms, imaging/follow-up/etc.).
- **Value sets / code systems** for DSP enumerations.
- **FML / StructureMap** skeletons: executable DSP→FHIR mappings for Condition
  and MedicationRequest as worked examples; see \`fml-strategy.html\` for phasing.
- **CapabilityStatement** declaring the four conformance levels.
- **One custom OperationDefinition:** \`$ground\` (turn-join).
- **Four normative rules** (R1–R4).

## Why R4

R4 has the US Core 7 ecosystem and widespread deployment. R5 xver extensions
fill the specific gaps (renderedDosageInstruction, DeviceUsage). See
\`design-decisions.html\`.

## Why \`$graphql\`

DSP is a graph. A canonical query published by the IG gives partners one
versioned read contract instead of N bespoke \`_include\` queries.
`);

w('input/pagecontent/background.md', `# Background — DSP 1.0

DSP is Microsoft's JSON payload emitted by Dragon Copilot after an ambient
clinical encounter:

- **Encounter context** — participants, timezone, locale, payload version, callback URL, quality flag.
- **Transcript** — speaker-turned utterances with monotonically increasing, stable turn indices.
- **Recording** (optional) — audio/video via signed URL.
- **Clinical resources** grouped by \`content_type\`:
  - \`document_section\` — narrative sections (HPI, ROS, A&P, Plan, Overview, …)
  - \`condition\` — problems/diagnoses, asserted or denied
  - \`order.{type}\` — medication / procedure / lab / imaging / dietary /
    immunization / study / therapy / activity / device / follow-up / referral

Every clinical resource carries \`transcript_turn_refs\`, a \`confidence\`
score, and \`spoken_forms\`. Grounding (traceability back to transcript turns)
is DSP's central promise.
`);

w('input/pagecontent/design-decisions.md', `# Design decisions

## R4 vs R5 vs R6

**Decision: R4 (4.0.1) core, R5 cross-version extensions for specific gaps.**

| Option | Pros | Cons |
|---|---|---|
| **R4** | US Core 7 ecosystem; widespread deployment; Bulk Data/SMART stable. | Missing \`MedicationRequest.renderedDosageInstruction\`, \`DeviceUsage\`, newer subscription/graphql semantics. |
| **R5** | Native fixes for most DSP-relevant gaps. | US Core lagging; partner servers rarely R5 yet. |
| **R6** | Even better alignment. | Not normative; not deployable. |

## \`$graphql\` as the read contract

DSP is a graph. Published canonical query = single versioned read contract
for all partners. See \`graphql.html\` and \`operations.html\`.

## FML + logical models

DSP gets a FHIR logical model (\`DspPayload\` / \`DspResource\` / per-type
submodels). FML maps DSP resources to FHIR profiles. Partners can execute via
\`StructureMap/$transform\` instead of writing bespoke converters. See \`fml-strategy.html\`.

## One custom operation, not ten

Every custom-op candidate was checked against base FHIR + major IGs (US Core,
Bulk Data, IPS, SMART, Subscriptions R5 Backport, CPG). All but one resolved
to an existing op. Survivor: \`$ground\` — transcript turn-join.

## Immunization / Study / Activity disambiguation

DSP collapses FHIR distinctions; the IG picks routing rules:

- \`IMMUNIZATION_ORDER\` + administration evidence → \`Immunization\`; else
  \`ImmunizationRecommendation\`.
- \`STUDY_ORDER\` + clinical-trial registry id → \`ResearchSubject\` +
  \`ResearchStudy\`; else \`ServiceRequest(category=study)\`.
- \`ACTIVITY_ORDER\` → \`CarePlan.activity\`; fall back to standalone
  \`ServiceRequest(category=activity)\` when per-activity provenance matters.
`);

w('input/pagecontent/mappings.md', `# DSP → FHIR mappings

Full side-by-side mappings: <https://brendankowitz.github.io/dsp-fhir/mapping>.

| DSP | FHIR target | Profile |
|---|---|---|
| \`document_section\` | \`Composition.section\` | \`DspComposition\` |
| \`condition\` | \`Condition\` | \`DspCondition\` |
| \`order.medication\` | \`MedicationRequest\` | \`DspMedicationRequest\` |
| \`order.procedure\` | \`ServiceRequest\` (procedure) | \`DspServiceRequestProcedure\` |
| \`order.lab\` | \`ServiceRequest\` (laboratory) | \`DspServiceRequestLab\` |
| \`order.imaging\` | \`ServiceRequest\` (imaging) | \`DspServiceRequestImaging\` |
| \`order.follow-up\` | \`ServiceRequest\` (follow-up) | \`DspServiceRequestFollowUp\` |
| \`order.referral\` | \`ServiceRequest\` (referral) | \`DspServiceRequestReferral\` |
| \`order.dietary\` | \`NutritionOrder\` | \`DspNutritionOrder\` |
| \`order.immunization\` (intent) | \`ImmunizationRecommendation\` | \`DspImmunizationRecommendation\` |
| \`order.immunization\` (administered) | \`Immunization\` | \`DspImmunization\` |
| \`order.device\` | \`DeviceRequest\` | \`DspDeviceRequest\` |
| \`order.therapy\` | \`ServiceRequest\` (therapy) + \`Goal\` | \`DspServiceRequestTherapy\` |
| \`order.activity\` | \`CarePlan.activity\` / \`ServiceRequest\` (fallback) | \`DspCarePlan\` |
| \`order.study\` (diagnostic) | \`ServiceRequest\` (study) | \`DspServiceRequestStudy\` |
| \`order.study\` (research) | \`ResearchSubject\` + \`ResearchStudy\` | \`DspResearchSubject\` |
`);

w('input/pagecontent/graphql.md', `# Canonical \`$graphql\` query

The IG publishes **one canonical GraphQL query** as the DSP read contract.
\`DSP-Core\` and \`DSP-Read\` servers SHALL answer it correctly; clients SHALL NOT
derive their own equivalent for conformance-critical reads.

See [\`input/examples/graphql-encounter-query.txt\`](../input/examples/graphql-encounter-query.txt).
`);

w('input/pagecontent/fml-strategy.md', `# FML / StructureMap strategy

## Why FML at all

FHIR Mapping Language (FML) — compiled to \`StructureMap\` resources and executed
via \`StructureMap/$transform\` — gives DSP-FHIR three things that prose mappings
on a website cannot:

1. **Executable.** Partners POST a DSP payload to \`$transform\` and receive a
   profile-valid FHIR Bundle. The mapping logic lives on a server, not in each
   partner's codebase.
2. **Machine-auditable.** FML is both human-readable and deterministically
   compilable; diffs between IG versions are reviewable.
3. **Publishable as artifacts.** StructureMaps live alongside profiles in the
   IG package, versioned together.

Precedent: [v2-to-FHIR](https://build.fhir.org/ig/HL7/v2-to-fhir/) and
[CDA-on-FHIR](http://hl7.org/fhir/us/ccda/) publish StructureMaps for the same
class of problem (non-FHIR source → FHIR).

## What FML is not good at

- **Routing decisions.** "If \`administered_at\` present → \`Immunization\`,
  else → \`ImmunizationRecommendation\`." Expressible via \`where\` clauses,
  but the conditional groups balloon. For DSP's split cases (immunization /
  study / activity) the IG documents the routing rule and expects producers or
  a thin pre-processor to split before \`$transform\`.
- **Stateful semantics.** R1 (turn-index stability across re-transcription
  versions) is controller logic, not mapping. StructureMap is deliberately pure.
- **Provenance generation.** FML can emit Provenance entries, but threading
  the source transcript through every target resource is awkward. The IG
  recommends generating R4 Provenance outside the map.

## Phasing

| Phase | Scope | Status in this draft |
|---|---|---|
| **1** | DSP logical models (envelope + per content_type) | ✓ included |
| **2** | FML for deterministic 1:1 maps (condition, document_section, medication/lab/imaging/procedure orders) | 2/6 skeletons included (condition, medication) |
| **3** | FML for routing-split maps (immunization, study, activity) with documented pre-split contract | planned |
| **4** | Reverse FHIR→DSP maps (round-trip proof) | planned |

## What ships in this draft

- \`input/fsh/logical-models.fsh\` — DSP envelope, context, transcript, recording, resource and four per-type logical models.
- \`input/maps/DspConditionToCondition.map\` — FML for DSP condition → FHIR Condition (full coverage of the DSP condition payload).
- \`input/maps/DspMedicationOrderToMedicationRequest.map\` — FML for DSP medication order → MedicationRequest (RxNorm resolution + rendered dosage instruction via R5 xver).
- \`input/maps/README.md\` — execution notes for matchbox / HAPI.

## Executing

\`\`\`bash
# matchbox (reference):
docker run -p 8080:8080 eu.gcr.io/fhir-ch/matchbox:latest
# Upload logical models + StructureMaps, then:
curl -X POST http://localhost:8080/fhir/StructureMap/\\$transform?source=${CANONICAL}/StructureMap/DspConditionToCondition \\
  -H 'Content-Type: application/fhir+json' \\
  --data @my-dsp-condition.json
\`\`\`
`);

w('input/pagecontent/operations.md', `# Operations audit (summary)

| Need | Operation | Source |
|---|---|---|
| Whole-encounter read | \`Encounter/$everything\` | Core FHIR |
| Canonical read contract | \`$graphql\` + published query | Core FHIR |
| Server capability declaration | \`CapabilityStatement\` | Core FHIR |
| Validate pre-commit | \`$validate\` | Core FHIR |
| Generate signed notes | \`Composition/$document\` | Core FHIR |
| Find latest note by type | \`$docref\` | US Core |
| Cross-encounter bulk | \`Patient/$export?_since=\` | Bulk Data |
| Terminology expand/lookup | \`$expand\`, \`$lookup\` | Core FHIR |
| Apply order-set plan | \`PlanDefinition/$apply\` | CPG |
| Patient matching | \`Patient/$match\` | Core FHIR |
| **DSP → FHIR transform** | **\`StructureMap/$transform\`** + published maps | **Core FHIR + this IG** |
| **Turn-join grounding** | **\`$ground\`** (custom) | **DSP-FHIR** |
`);

w('input/pagecontent/normative-rules.md', `# Normative rules (R1–R4)

## R1 · Transcript turn-index stability
Turn indices **SHALL** be immutable within a \`DocumentReference.meta.versionId\`.
Re-transcription **SHALL** create a new \`DocumentReference\` version.

## R2 · Recording content binding
Recordings **SHALL** be served from a \`Binary\` endpoint on the issuing server,
under SMART on FHIR scopes for the patient compartment.

## R3 · Payload-version negotiation
Servers **SHALL** advertise accepted and emitted DSP \`payload-version\` values in
\`CapabilityStatement\` via the \`dsp-payload-versions\` extension. No silent upgrades.

## R4 · Provenance per ingest
Every ingest transaction **SHALL** produce at least one \`Provenance\` targeting
every resource created/updated, with \`entity\` referencing the source transcript
\`DocumentReference\`.
`);

w('input/pagecontent/changelog.md', `# Changelog

## ${VERSION} — initial draft

- Profiles for all 15 DSP resource types.
- Extensions for DSP-specific semantics.
- Value sets / code systems.
- CapabilityStatement (DSP-Core level).
- OperationDefinition: \`$ground\`.
- DSP logical models (envelope + per content_type).
- FML skeletons: condition, medication order.
- Normative rules R1–R4.
- Worked example Bundle + illustrative DSP condition input.
`);

// ---------- zip it ----------
mkdirSync(dirname(OUT_ZIP), { recursive: true });
if (existsSync(OUT_ZIP)) rmSync(OUT_ZIP);
const zip = new AdmZip();
zip.addLocalFolder(STAGE, 'dsp-fhir-ig');
zip.writeZip(OUT_ZIP);
rmSync(STAGE, { recursive: true, force: true });

const sizeKb = (zip.toBuffer().length / 1024).toFixed(1);
console.log(`wrote ${OUT_ZIP} (${sizeKb} KB)`);
