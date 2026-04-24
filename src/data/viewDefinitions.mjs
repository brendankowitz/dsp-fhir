// SQL-on-FHIR v2 ViewDefinitions per DSP-FHIR resource type.
// Spec: https://build.fhir.org/ig/FHIR/sql-on-fhir-v2/
//
// Each view is authored to be consumable by any SQL-on-FHIR v2 runtime
// (Pathling, sof-exec, Aidbox SQL-on-FHIR, Databricks FHIR). The pattern:
//   - root-level select[] produces the main flattened row
//   - nested select[] with forEach / forEachOrNull unnests repeating fields
//     (separate view for *_coding where multi-coding matters)
//   - DSP extensions are flattened as first-class columns via
//     extension('url').value[x] paths, so every resource has the same
//     cross-cutting band (confidence_score, transcript_ref, turn_indices, etc.)
//
// Views are shipped inside the IG zip at ViewDefinition/*.json.

// -------- shared helpers --------------------------------------------------

const DSP_EXT = 'https://dsp-fhir.org/StructureDefinition';
const DSP_CS = 'https://dsp-fhir.org/CodeSystem';

// Columns every DSP-FHIR resource view exposes. Referenced via spread so
// upstream authors see them unambiguously on every view.
const dspCrossCuttingColumns = [
  { name: 'id', path: 'id', type: 'id', description: 'Server-assigned logical id.' },
  { name: 'version_id', path: 'meta.versionId', type: 'id', description: 'FHIR version id (drives NEW/UPDATED classification).' },
  { name: 'last_updated', path: 'meta.lastUpdated', type: 'instant', description: 'Instant of last mutation.' },
  { name: 'meta_source', path: 'meta.source', type: 'uri' },
  { name: 'payload_version', path: `meta.tag.where(system='${DSP_CS}/payload-version').code.first()`, type: 'code', description: 'DSP payload version this resource was last emitted under.' },
  { name: 'confidence_score', path: `extension('${DSP_EXT}/confidence-score').value.ofType(decimal)`, type: 'decimal', description: 'DSP confidence (0..1).' },
  { name: 'transcript_ref', path: `extension('${DSP_EXT}/transcript-turn-refs').extension('transcript').value.ofType(Reference).reference`, type: 'string', description: 'DocumentReference/<id>/_history/<v> that pins the transcript version for turn indices.' },
  { name: 'turn_indices', path: `extension('${DSP_EXT}/transcript-turn-refs').extension('turn').value.ofType(integer)`, type: 'integer', collection: true, description: 'Turn indices joined by $ground into transcript content.' },
  { name: 'spoken_forms', path: `extension('${DSP_EXT}/spoken-forms').extension('form').value.ofType(string)`, type: 'string', collection: true },
  { name: 'search_terms', path: `extension('${DSP_EXT}/search-terms').extension('term').value.ofType(string)`, type: 'string', collection: true },
];

// Reusable identifier accessor by type code (v2-0203). Returns a single value
// via .first() to keep the column scalar.
const identifierByType = (typeCode) =>
  `identifier.where(type.coding.where(system='http://terminology.hl7.org/CodeSystem/v2-0203' and code='${typeCode}').exists()).value.first()`;

// Subject / encounter ref unwrappers (strip "Patient/" / "Encounter/" prefix)
const refId = (path, prefix) =>
  `${path}.where(reference.startsWith('${prefix}/')).reference.substring(${prefix.length + 1}).first()`;

// -------- view factories -------------------------------------------------

const viewBase = (url, name, resource, title, description) => ({
  resourceType: 'ViewDefinition',
  url: `https://dsp-fhir.org/ViewDefinition/${url}`,
  name,
  title,
  status: 'draft',
  description,
  resource,
  fhirVersion: ['4.0.1'],
});

// ====================================================================
// 1. ENVELOPE
// ====================================================================

const VD_BUNDLE = {
  ...viewBase('dsp-bundle', 'dsp_bundle', 'Bundle', 'DSP Bundle envelope', 'Flattens DSP-FHIR Bundle-level tags and extensions carrying payload version + priority + callback url.'),
  select: [{
    column: [
      { name: 'id', path: 'id', type: 'id' },
      { name: 'type', path: 'type', type: 'code' },
      { name: 'timestamp', path: 'timestamp', type: 'instant' },
      { name: 'payload_version', path: `meta.tag.where(system='${DSP_CS}/payload-version').code.first()`, type: 'code' },
      { name: 'payload_version_major', path: `meta.extension('${DSP_EXT}/payload-version').extension('major').value.ofType(integer)`, type: 'integer' },
      { name: 'payload_version_minor', path: `meta.extension('${DSP_EXT}/payload-version').extension('minor').value.ofType(integer)`, type: 'integer' },
      { name: 'payload_version_revision', path: `meta.extension('${DSP_EXT}/payload-version').extension('revision').value.ofType(integer)`, type: 'integer' },
      { name: 'payload_version_quality', path: `meta.extension('${DSP_EXT}/payload-version').extension('quality').value.ofType(code)`, type: 'code' },
      { name: 'priority', path: `entry.resource.ofType(Encounter).priority.coding.where(system='http://terminology.hl7.org/CodeSystem/v3-ActPriority').code.first()`, type: 'code' },
      { name: 'external_callback_url', path: `entry.resource.ofType(Encounter).extension('${DSP_EXT}/dsp-external-callback-url').value.ofType(url)`, type: 'url' },
      { name: 'entry_count', path: 'entry.count()', type: 'integer' },
    ],
  }],
};

// ====================================================================
// 2. ENCOUNTER BLOCK
// ====================================================================

const VD_ENCOUNTER = {
  ...viewBase('dsp-encounter', 'dsp_encounter', 'Encounter', 'DSP Encounter', 'Flattens the DSP encounter: class, type, period, tenant org, serviceProvider, accompanied-by, locale, timezone.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'class_code', path: 'class.code', type: 'code' },
      { name: 'class_system', path: 'class.system', type: 'uri' },
      { name: 'type_text', path: 'type.text.first()', type: 'string' },
      { name: 'priority_code', path: `priority.coding.where(system='http://terminology.hl7.org/CodeSystem/v3-ActPriority').code.first()`, type: 'code' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string', description: "Strip 'Patient/' prefix." },
      { name: 'period_start', path: 'period.start', type: 'dateTime' },
      { name: 'period_end', path: 'period.end', type: 'dateTime' },
      { name: 'reason_text', path: 'reasonCode.text.first()', type: 'string' },
      { name: 'service_provider_org_id', path: `serviceProvider.reference.substring(13)`, type: 'string', description: "Strip 'Organization/' prefix." },
      { name: 'tenant_organization_id', path: `extension('${DSP_EXT}/dsp-tenant-organization').value.ofType(Reference).reference.substring(13)`, type: 'string' },
      { name: 'external_encounter_id', path: `identifier.where(type.coding.where(code='VN').exists()).value.first()`, type: 'string' },
      { name: 'correlation_id', path: `identifier.where(system='https://dsp-fhir.org/correlation-id').value.first()`, type: 'string' },
      { name: 'external_callback_url', path: `extension('${DSP_EXT}/dsp-external-callback-url').value.ofType(url)`, type: 'url' },
      { name: 'recording_locale', path: `extension('${DSP_EXT}/recording-locale').value.ofType(code)`, type: 'code' },
      { name: 'timezone', path: `extension('${DSP_EXT}/dsp-timezone').value.ofType(string)`, type: 'string' },
      { name: 'accompanied_by_display', path: `participant.where(type.coding.where(system='http://terminology.hl7.org/CodeSystem/v3-ParticipationType' and code='ESC').exists()).individual.display.first()`, type: 'string' },
      { name: 'accompanied_by_related_person_id', path: `participant.where(type.coding.where(code='ESC').exists()).individual.reference.where($this.startsWith('RelatedPerson/')).substring(14).first()`, type: 'string' },
    ],
  }],
};

const VD_PATIENT = {
  ...viewBase('dsp-patient', 'dsp_patient', 'Patient', 'DSP Patient', 'Flattens DSP patient block including MRN, gender identity, pronouns.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'mrn', path: identifierByType('MR'), type: 'string' },
      { name: 'name_text', path: 'name.text.first()', type: 'string' },
      { name: 'family', path: 'name.family.first()', type: 'string' },
      { name: 'given', path: 'name.given.first()', type: 'string' },
      { name: 'gender', path: 'gender', type: 'code' },
      { name: 'birth_date', path: 'birthDate', type: 'date' },
      { name: 'age_years', path: `extension('${DSP_EXT}/source-reported-age').value.ofType(Age).value`, type: 'decimal' },
      { name: 'pronouns', path: `extension('http://hl7.org/fhir/us/core/StructureDefinition/us-core-pronouns').value.ofType(CodeableConcept).coding.display.first()`, type: 'string' },
      { name: 'gender_identity', path: `extension('http://hl7.org/fhir/us/core/StructureDefinition/us-core-genderIdentity').value.ofType(CodeableConcept).coding.display.first()`, type: 'string' },
      { name: 'deceased', path: 'deceased.ofType(boolean)', type: 'boolean' },
    ],
  }],
};

const VD_PRACTITIONER = {
  ...viewBase('dsp-practitioner', 'dsp_practitioner', 'Practitioner', 'DSP Practitioner', 'Flattens DSP practitioner block: NPI, qualifications, specialties (roles live on PractitionerRole).'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'npi', path: `identifier.where(system='http://hl7.org/fhir/sid/us-npi').value.first()`, type: 'string' },
      { name: 'name_text', path: 'name.text.first()', type: 'string' },
      { name: 'family', path: 'name.family.first()', type: 'string' },
      { name: 'given', path: 'name.given.first()', type: 'string' },
      { name: 'qualifications', path: 'qualification.code.text', type: 'string', collection: true },
      { name: 'qualification_codes', path: 'qualification.code.coding.code', type: 'code', collection: true },
    ],
  }],
};

const VD_ORGANIZATION = {
  ...viewBase('dsp-organization', 'dsp_organization', 'Organization', 'DSP Organization', 'Flattens DSP Organization (both clinical serviceProvider and DSP tenant-org).'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'name', path: 'name', type: 'string' },
      { name: 'type_code', path: 'type.coding.code.first()', type: 'code' },
      { name: 'type_system', path: 'type.coding.system.first()', type: 'uri' },
      { name: 'tenant_uuid', path: `identifier.where(system='${DSP_CS}/tenant-id').value.first()`, type: 'string' },
    ],
  }],
};

// ====================================================================
// 3. RECORDINGS / SESSIONS / TRANSCRIPT
// ====================================================================

const VD_MEDIA = {
  ...viewBase('dsp-media', 'dsp_media', 'Media', 'DSP recording Media', 'Flattens DSP recording metadata: url, content-type, period, subject, encounter.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'type_code', path: 'type.coding.code.first()', type: 'code' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'period_start', path: 'createdPeriod.start', type: 'dateTime' },
      { name: 'period_end', path: 'createdPeriod.end', type: 'dateTime' },
      { name: 'content_type', path: 'content.contentType', type: 'code' },
      { name: 'content_url', path: 'content.url', type: 'url' },
      { name: 'content_size', path: 'content.size', type: 'unsignedInt' },
    ],
  }],
};

const VD_PROVENANCE_SESSION = {
  ...viewBase('dsp-provenance-session', 'dsp_provenance_session', 'Provenance', 'DSP capture-session Provenance', 'Flattens DSP session metadata (DAX_CAPTURE activity).'),
  where: [{ path: `activity.coding.where(system='${DSP_CS}/activity').exists()` }],
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'recorded', path: 'recorded', type: 'instant' },
      { name: 'activity_code', path: `activity.coding.where(system='${DSP_CS}/activity').code.first()`, type: 'code' },
      { name: 'target_ref', path: 'target.reference.first()', type: 'string' },
      { name: 'encounter_id', path: `target.where(reference.startsWith('Encounter/')).reference.substring(10).first()`, type: 'string' },
      { name: 'author_practitioner_id', path: `agent.where(who.reference.startsWith('Practitioner/')).who.reference.substring(13).first()`, type: 'string' },
      { name: 'custodian_org_id', path: `agent.where(type.coding.code='custodian').who.reference.substring(13).first()`, type: 'string' },
    ],
  }],
};

const VD_DOCREF_TRANSCRIPT = {
  ...viewBase('dsp-document-reference-transcript', 'dsp_document_reference_transcript', 'DocumentReference', 'DSP transcript DocumentReference', 'Flattens the DocumentReference whose attachment carries DSP transcript turns.'),
  where: [{ path: `type.coding.where(system='http://loinc.org' and (code='11488-4' or code='11506-3')).exists()` }],
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'doc_status', path: 'docStatus', type: 'code' },
      { name: 'type_code', path: 'type.coding.code.first()', type: 'code' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'encounter_id', path: `context.encounter.reference.substring(10).first()`, type: 'string' },
      { name: 'attachment_content_type', path: 'content.attachment.contentType.first()', type: 'code' },
      { name: 'attachment_url', path: 'content.attachment.url.first()', type: 'url' },
      { name: 'speaker_count', path: `extension('${DSP_EXT}/transcript-speaker-count').value.ofType(integer)`, type: 'integer' },
    ],
  }],
};

// ====================================================================
// 4. DOCUMENT (Composition + sections)
// ====================================================================

const VD_COMPOSITION = {
  ...viewBase('dsp-composition', 'dsp_composition', 'Composition', 'DSP Composition', 'Flattens the clinical note Composition (type/status/title/author).'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'type_code', path: 'type.coding.code.first()', type: 'code' },
      { name: 'type_display', path: 'type.coding.display.first()', type: 'string' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'date', path: 'date', type: 'dateTime' },
      { name: 'author_practitioner_id', path: `author.where(reference.startsWith('Practitioner/')).reference.substring(13).first()`, type: 'string' },
      { name: 'title', path: 'title', type: 'string' },
      { name: 'language', path: 'language', type: 'code' },
      { name: 'section_count', path: 'section.count()', type: 'integer' },
    ],
  }],
};

const VD_COMPOSITION_SECTION = {
  ...viewBase('dsp-composition-section', 'dsp_composition_section', 'Composition', 'DSP Composition section (unnested)', 'One row per Composition.section — unnests section array for warehouse-friendly section analytics.'),
  select: [{
    column: [
      { name: 'composition_id', path: 'id', type: 'id' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
    ],
    select: [{
      forEach: 'section',
      column: [
        { name: 'section_title', path: 'title', type: 'string' },
        { name: 'section_code_system', path: 'code.coding.system.first()', type: 'uri' },
        { name: 'section_code', path: 'code.coding.code.first()', type: 'code' },
        { name: 'section_code_display', path: 'code.coding.display.first()', type: 'string' },
        { name: 'section_text_status', path: 'text.status', type: 'code' },
        { name: 'has_narrative', path: 'text.div.exists()', type: 'boolean' },
        { name: 'entry_count', path: 'entry.count()', type: 'integer' },
      ],
    }],
  }],
};

// ====================================================================
// 5. DOCUMENT SECTION deep-dive view (alias of composition-section for
//    the deep-dive page; exposes DSP section-type mapping extension if
//    we start carrying one).
// ====================================================================

const VD_DOCUMENT_SECTION = {
  ...viewBase('dsp-document-section', 'dsp_document_section', 'Composition', 'DSP document-section', 'Section-unnested view specifically for DSP document_section resources. Includes DSP section-type extension if carried.'),
  select: [{
    column: [
      { name: 'composition_id', path: 'id', type: 'id' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'composition_last_updated', path: 'meta.lastUpdated', type: 'instant' },
    ],
    select: [{
      forEach: 'section',
      column: [
        { name: 'section_title', path: 'title', type: 'string' },
        { name: 'loinc_code', path: `code.coding.where(system='http://loinc.org').code.first()`, type: 'code' },
        { name: 'dsp_section_type', path: `extension('${DSP_EXT}/dsp-section-type').value.ofType(code)`, type: 'code' },
        { name: 'text_status', path: 'text.status', type: 'code' },
        { name: 'narrative_length_chars', path: 'text.div.length()', type: 'integer' },
        { name: 'entry_count', path: 'entry.count()', type: 'integer' },
      ],
    }],
  }],
};

// ====================================================================
// 6. CONDITION
// ====================================================================

const VD_CONDITION = {
  ...viewBase('dsp-condition', 'dsp_condition', 'Condition', 'DSP Condition', 'Flattens a DSP condition resource: status, severity, onset, abatement, primary code.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'clinical_status', path: 'clinicalStatus.coding.code.first()', type: 'code' },
      { name: 'verification_status', path: 'verificationStatus.coding.code.first()', type: 'code' },
      { name: 'category_code', path: `category.coding.where(system='http://terminology.hl7.org/CodeSystem/condition-category').code.first()`, type: 'code' },
      { name: 'severity_code', path: 'severity.coding.code.first()', type: 'code' },
      { name: 'code_text', path: 'code.text', type: 'string' },
      { name: 'snomed_code', path: `code.coding.where(system='http://snomed.info/sct').code.first()`, type: 'code' },
      { name: 'icd10_code', path: `code.coding.where(system='http://hl7.org/fhir/sid/icd-10-cm').code.first()`, type: 'code' },
      { name: 'primary_display', path: 'code.coding.display.first()', type: 'string' },
      { name: 'body_site_code', path: 'bodySite.coding.code.first()', type: 'code' },
      { name: 'onset_datetime', path: 'onset.ofType(dateTime)', type: 'dateTime' },
      { name: 'onset_string', path: 'onset.ofType(string)', type: 'string' },
      { name: 'abatement_datetime', path: 'abatement.ofType(dateTime)', type: 'dateTime' },
      { name: 'stage_summary', path: 'stage.summary.text.first()', type: 'string' },
      { name: 'recorded_date', path: 'recordedDate', type: 'dateTime' },
      { name: 'priority', path: `extension('${DSP_EXT}/dsp-resource-priority').value.ofType(code)`, type: 'code' },
      { name: 'concept_id', path: `extension('${DSP_EXT}/dsp-concept-id').value.ofType(string)`, type: 'string' },
    ],
  }],
};

const VD_CONDITION_CODING = {
  ...viewBase('dsp-condition-coding', 'dsp_condition_coding', 'Condition', 'DSP Condition coding (unnested)', 'One row per Condition.code.coding so SNOMED+ICD-10 co-codings are queryable.'),
  select: [{
    column: [{ name: 'condition_id', path: 'id', type: 'id' }],
    select: [{
      forEach: 'code.coding',
      column: [
        { name: 'system', path: 'system', type: 'uri' },
        { name: 'code', path: 'code', type: 'code' },
        { name: 'display', path: 'display', type: 'string' },
        { name: 'user_selected', path: 'userSelected', type: 'boolean' },
      ],
    }],
  }],
};

// ====================================================================
// 7. MEDICATION REQUEST
// ====================================================================

const VD_MEDICATION_REQUEST = {
  ...viewBase('dsp-medication-request', 'dsp_medication_request', 'MedicationRequest', 'DSP MedicationRequest', 'Flattens DSP medication orders: route/dose/frequency/duration, substitution, first dosageInstruction.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'intent', path: 'intent', type: 'code' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'authored_on', path: 'authoredOn', type: 'dateTime' },
      { name: 'requester_practitioner_id', path: `requester.reference.where($this.startsWith('Practitioner/')).substring(13).first()`, type: 'string' },
      { name: 'medication_code_system', path: `medication.ofType(CodeableConcept).coding.system.first()`, type: 'uri' },
      { name: 'medication_code', path: `medication.ofType(CodeableConcept).coding.code.first()`, type: 'code' },
      { name: 'medication_display', path: `medication.ofType(CodeableConcept).coding.display.first()`, type: 'string' },
      { name: 'medication_text', path: `medication.ofType(CodeableConcept).text`, type: 'string' },
      { name: 'medication_reference', path: `medication.ofType(Reference).reference`, type: 'string', description: 'Populated when Medication is a contained/shared resource instead of inline CodeableConcept.' },
      { name: 'dose_value', path: 'dosageInstruction.doseAndRate.dose.ofType(Quantity).value.first()', type: 'decimal' },
      { name: 'dose_unit', path: 'dosageInstruction.doseAndRate.dose.ofType(Quantity).unit.first()', type: 'string' },
      { name: 'route_code', path: 'dosageInstruction.route.coding.code.first()', type: 'code' },
      { name: 'frequency', path: 'dosageInstruction.timing.repeat.frequency.first()', type: 'integer' },
      { name: 'period', path: 'dosageInstruction.timing.repeat.period.first()', type: 'decimal' },
      { name: 'period_unit', path: 'dosageInstruction.timing.repeat.periodUnit.first()', type: 'code' },
      { name: 'duration', path: 'dosageInstruction.timing.repeat.bounds.ofType(Duration).value.first()', type: 'decimal' },
      { name: 'duration_unit', path: 'dosageInstruction.timing.repeat.bounds.ofType(Duration).unit.first()', type: 'string' },
      { name: 'as_needed', path: 'dosageInstruction.asNeeded.ofType(boolean).first()', type: 'boolean' },
      { name: 'substitution_allowed', path: 'substitution.allowed.ofType(boolean)', type: 'boolean' },
      { name: 'reason_reference', path: 'reasonReference.reference.first()', type: 'string' },
      { name: 'refills', path: 'dispenseRequest.numberOfRepeatsAllowed', type: 'unsignedInt' },
    ],
  }],
};

// ====================================================================
// 8. SERVICE REQUEST variants (lab/imaging/procedure/referral/follow-up/therapy/study/activity)
// ====================================================================

function serviceRequestView(slug, name, title, categoryCode, extra = []) {
  return {
    ...viewBase(slug, name, 'ServiceRequest', title, `Flattens DSP ${title.toLowerCase()} orders. Filtered by category=${categoryCode}.`),
    where: [{ path: `category.coding.where(code='${categoryCode}').exists()` }],
    select: [{
      column: [
        ...dspCrossCuttingColumns,
        { name: 'status', path: 'status', type: 'code' },
        { name: 'intent', path: 'intent', type: 'code' },
        { name: 'priority', path: 'priority', type: 'code' },
        { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
        { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
        { name: 'authored_on', path: 'authoredOn', type: 'dateTime' },
        { name: 'requester_practitioner_id', path: `requester.reference.where($this.startsWith('Practitioner/')).substring(13).first()`, type: 'string' },
        { name: 'code_system', path: 'code.coding.system.first()', type: 'uri' },
        { name: 'code', path: 'code.coding.code.first()', type: 'code' },
        { name: 'code_display', path: 'code.coding.display.first()', type: 'string' },
        { name: 'code_text', path: 'code.text', type: 'string' },
        { name: 'reason_code_text', path: 'reasonCode.text.first()', type: 'string' },
        { name: 'reason_reference', path: 'reasonReference.reference.first()', type: 'string' },
        { name: 'body_site_code', path: 'bodySite.coding.code.first()', type: 'code' },
        ...extra,
      ],
    }],
  };
}

const VD_SR_LAB = serviceRequestView('dsp-service-request-lab', 'dsp_service_request_lab', 'DSP Lab order (ServiceRequest)', 'laboratory', [
  { name: 'specimen_ref', path: 'specimen.reference.first()', type: 'string' },
  { name: 'occurrence_datetime', path: 'occurrence.ofType(dateTime)', type: 'dateTime' },
  { name: 'fasting_required', path: `extension('http://hl7.org/fhir/StructureDefinition/servicerequest-questionnaireRequest').exists()`, type: 'boolean' },
]);

const VD_SR_IMAGING = serviceRequestView('dsp-service-request-imaging', 'dsp_service_request_imaging', 'DSP Imaging order (ServiceRequest)', 'imaging', [
  { name: 'modality_code', path: `extension('${DSP_EXT}/dsp-imaging-modality').value.ofType(code)`, type: 'code' },
  { name: 'contrast_used', path: `extension('${DSP_EXT}/dsp-imaging-contrast').value.ofType(boolean)`, type: 'boolean' },
  { name: 'laterality_code', path: `bodySite.coding.where(system='http://snomed.info/sct').code.first()`, type: 'code' },
]);

const VD_SR_PROCEDURE = serviceRequestView('dsp-service-request-procedure', 'dsp_service_request_procedure', 'DSP Procedure order (ServiceRequest)', 'procedure', [
  { name: 'occurrence_datetime', path: 'occurrence.ofType(dateTime)', type: 'dateTime' },
  { name: 'occurrence_period_start', path: 'occurrence.ofType(Period).start', type: 'dateTime' },
  { name: 'performer_type_code', path: 'performerType.coding.code.first()', type: 'code' },
]);

const VD_SR_REFERRAL = serviceRequestView('dsp-service-request-referral', 'dsp_service_request_referral', 'DSP Referral (ServiceRequest)', 'referral', [
  { name: 'performer_practitioner_role_id', path: `performer.reference.where($this.startsWith('PractitionerRole/')).substring(17).first()`, type: 'string' },
  { name: 'performer_related_person_id', path: `performer.reference.where($this.startsWith('RelatedPerson/')).substring(14).first()`, type: 'string' },
  { name: 'specialty_code', path: 'performerType.coding.code.first()', type: 'code' },
  { name: 'specialty_display', path: 'performerType.coding.display.first()', type: 'string' },
]);

const VD_SR_FOLLOW_UP = serviceRequestView('dsp-service-request-follow-up', 'dsp_service_request_follow_up', 'DSP Follow-up (ServiceRequest)', 'follow-up', [
  { name: 'occurrence_timing_bounds_value', path: 'occurrence.ofType(Timing).repeat.bounds.ofType(Duration).value', type: 'decimal' },
  { name: 'occurrence_timing_bounds_unit', path: 'occurrence.ofType(Timing).repeat.bounds.ofType(Duration).unit', type: 'string' },
  { name: 'approximate_match', path: `extension('${DSP_EXT}/approximate-match').value.ofType(boolean)`, type: 'boolean' },
]);

const VD_APPOINTMENT_FOLLOW_UP = {
  ...viewBase('dsp-appointment-follow-up', 'dsp_appointment_follow_up', 'Appointment', 'DSP proposed follow-up Appointment', 'Flattens the proposed Appointment materialized via ActivityDefinition/$apply from a DSP follow-up ServiceRequest.'),
  where: [{ path: `basedOn.reference.where($this.startsWith('ServiceRequest/')).exists()` }],
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'based_on_service_request', path: `basedOn.reference.where($this.startsWith('ServiceRequest/')).substring(15).first()`, type: 'string' },
      { name: 'start', path: 'start', type: 'instant' },
      { name: 'end', path: 'end', type: 'instant' },
      { name: 'minutes_duration', path: 'minutesDuration', type: 'positiveInt' },
      { name: 'patient_ref', path: `participant.actor.reference.where($this.startsWith('Patient/')).substring(8).first()`, type: 'string' },
      { name: 'practitioner_ref', path: `participant.actor.reference.where($this.startsWith('Practitioner/')).substring(13).first()`, type: 'string' },
      { name: 'approximate_match', path: `extension('${DSP_EXT}/approximate-match').value.ofType(boolean)`, type: 'boolean' },
    ],
  }],
};

const VD_SR_THERAPY = serviceRequestView('dsp-service-request-therapy', 'dsp_service_request_therapy', 'DSP Therapy order (ServiceRequest)', 'therapy', [
  { name: 'therapy_kind', path: `category.coding.where(system='${DSP_CS}/therapy-kind').code.first()`, type: 'code', description: 'PT/OT/SLP/respiratory/behavioral etc.' },
  { name: 'frequency', path: 'occurrence.ofType(Timing).repeat.frequency.first()', type: 'integer' },
  { name: 'period', path: 'occurrence.ofType(Timing).repeat.period.first()', type: 'decimal' },
  { name: 'period_unit', path: 'occurrence.ofType(Timing).repeat.periodUnit.first()', type: 'code' },
]);

const VD_GOAL_THERAPY = {
  ...viewBase('dsp-goal-therapy', 'dsp_goal_therapy', 'Goal', 'DSP Therapy Goal', 'Flattens the optional Goal attached to a DSP therapy ServiceRequest.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'lifecycle_status', path: 'lifecycleStatus', type: 'code' },
      { name: 'achievement_status', path: 'achievementStatus.coding.code.first()', type: 'code' },
      { name: 'description_text', path: 'description.text', type: 'string' },
      { name: 'target_measure_code', path: 'target.measure.coding.code.first()', type: 'code' },
      { name: 'target_quantity_value', path: 'target.detail.ofType(Quantity).value.first()', type: 'decimal' },
      { name: 'target_due_date', path: 'target.due.ofType(date).first()', type: 'date' },
      { name: 'addresses_condition_ref', path: `addresses.reference.where($this.startsWith('Condition/')).substring(10).first()`, type: 'string' },
    ],
  }],
};

const VD_SR_ACTIVITY = serviceRequestView('dsp-service-request-activity', 'dsp_service_request_activity', 'DSP Activity order (ServiceRequest fallback)', 'activity', [
  { name: 'activity_description', path: 'note.text.first()', type: 'string' },
]);

const VD_CAREPLAN_ACTIVITY = {
  ...viewBase('dsp-care-plan-activity', 'dsp_care_plan_activity', 'CarePlan', 'DSP CarePlan activity (preferred)', 'One row per CarePlan.activity — the preferred home for DSP order.activity.'),
  select: [{
    column: [
      { name: 'care_plan_id', path: 'id', type: 'id' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'care_plan_status', path: 'status', type: 'code' },
      { name: 'care_plan_intent', path: 'intent', type: 'code' },
    ],
    select: [{
      forEach: 'activity',
      column: [
        { name: 'activity_kind', path: 'detail.kind', type: 'code' },
        { name: 'activity_status', path: 'detail.status', type: 'code' },
        { name: 'activity_code_system', path: 'detail.code.coding.system.first()', type: 'uri' },
        { name: 'activity_code', path: 'detail.code.coding.code.first()', type: 'code' },
        { name: 'activity_display', path: 'detail.code.coding.display.first()', type: 'string' },
        { name: 'activity_description', path: 'detail.description', type: 'string' },
        { name: 'activity_scheduled_period_start', path: 'detail.scheduled.ofType(Period).start', type: 'dateTime' },
        { name: 'activity_reason_ref', path: 'detail.reasonReference.reference.first()', type: 'string' },
        { name: 'reference_to_request', path: 'reference.reference', type: 'string', description: "Populated when the activity references a separate ServiceRequest/Appointment." },
      ],
    }],
  }],
};

const VD_SR_STUDY = serviceRequestView('dsp-service-request-study', 'dsp_service_request_study', 'DSP Study (ServiceRequest)', 'study', [
  { name: 'study_reference', path: 'supportingInfo.reference.first()', type: 'string' },
]);

const VD_RESEARCH_SUBJECT = {
  ...viewBase('dsp-research-subject', 'dsp_research_subject', 'ResearchSubject', 'DSP ResearchSubject', 'Flattens DSP study enrollment as a ResearchSubject.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'subject_patient_id', path: `individual.reference.substring(8)`, type: 'string' },
      { name: 'study_id', path: `study.reference.substring(14)`, type: 'string', description: "Strip 'ResearchStudy/' prefix." },
      { name: 'assigned_arm', path: 'assignedArm', type: 'string' },
      { name: 'actual_arm', path: 'actualArm', type: 'string' },
      { name: 'period_start', path: 'period.start', type: 'dateTime' },
      { name: 'period_end', path: 'period.end', type: 'dateTime' },
      { name: 'consent_ref', path: 'consent.reference', type: 'string' },
    ],
  }],
};

const VD_RESEARCH_STUDY = {
  ...viewBase('dsp-research-study', 'dsp_research_study', 'ResearchStudy', 'DSP ResearchStudy', 'Flattens the ResearchStudy metadata DSP references for trial enrollment.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'title', path: 'title', type: 'string' },
      { name: 'nct_id', path: `identifier.where(system='http://clinicaltrials.gov').value.first()`, type: 'string' },
      { name: 'phase_code', path: 'phase.coding.code.first()', type: 'code' },
      { name: 'primary_purpose_code', path: 'primaryPurposeType.coding.code.first()', type: 'code' },
      { name: 'sponsor_org_id', path: `sponsor.reference.substring(13)`, type: 'string' },
      { name: 'start_date', path: 'period.start', type: 'dateTime' },
      { name: 'end_date', path: 'period.end', type: 'dateTime' },
    ],
  }],
};

// ====================================================================
// 9. DIETARY / IMMUNIZATION / DEVICE
// ====================================================================

const VD_NUTRITION_ORDER = {
  ...viewBase('dsp-nutrition-order', 'dsp_nutrition_order', 'NutritionOrder', 'DSP Dietary order (NutritionOrder)', 'Flattens DSP dietary orders: oralDiet type, food preferences, exclusions.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'intent', path: 'intent', type: 'code' },
      { name: 'patient_id', path: `patient.reference.substring(8)`, type: 'string' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'date_time', path: 'dateTime', type: 'dateTime' },
      { name: 'orderer_practitioner_id', path: `orderer.reference.substring(13)`, type: 'string' },
      { name: 'oral_diet_type_code', path: 'oralDiet.type.coding.code.first()', type: 'code' },
      { name: 'oral_diet_type_display', path: 'oralDiet.type.coding.display.first()', type: 'string' },
      { name: 'oral_diet_schedule', path: 'oralDiet.schedule.repeat.frequency.first()', type: 'integer' },
      { name: 'food_preference_modifiers', path: 'foodPreferenceModifier.coding.code', type: 'code', collection: true },
      { name: 'exclude_food_modifiers', path: 'excludeFoodModifier.coding.code', type: 'code', collection: true },
      { name: 'instruction', path: 'note.text.first()', type: 'string' },
    ],
  }],
};

const VD_IMMUNIZATION_RECOMMENDATION = {
  ...viewBase('dsp-immunization-recommendation', 'dsp_immunization_recommendation', 'ImmunizationRecommendation', 'DSP Immunization proposal (ImmunizationRecommendation)', 'Flattens DSP proposed immunizations (order.immunization before administration).'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'patient_id', path: `patient.reference.substring(8)`, type: 'string' },
      { name: 'date', path: 'date', type: 'dateTime' },
      { name: 'authority_org_id', path: `authority.reference.substring(13)`, type: 'string' },
    ],
    select: [{
      forEach: 'recommendation',
      column: [
        { name: 'vaccine_code', path: 'vaccineCode.coding.code.first()', type: 'code' },
        { name: 'vaccine_system', path: 'vaccineCode.coding.system.first()', type: 'uri' },
        { name: 'vaccine_display', path: 'vaccineCode.coding.display.first()', type: 'string' },
        { name: 'target_disease_code', path: 'targetDisease.coding.code.first()', type: 'code' },
        { name: 'forecast_status_code', path: 'forecastStatus.coding.code.first()', type: 'code' },
        { name: 'dose_number', path: 'doseNumber.ofType(positiveInt)', type: 'positiveInt' },
        { name: 'recommended_date', path: `dateCriterion.where(code.coding.code='30981-5').value.first()`, type: 'dateTime', description: 'LOINC 30981-5 = Earliest date to give.' },
      ],
    }],
  }],
};

const VD_IMMUNIZATION = {
  ...viewBase('dsp-immunization', 'dsp_immunization', 'Immunization', 'DSP Immunization (administered)', 'Flattens an administered Immunization (post-administration).'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'patient_id', path: `patient.reference.substring(8)`, type: 'string' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'occurrence_datetime', path: 'occurrence.ofType(dateTime)', type: 'dateTime' },
      { name: 'vaccine_code', path: 'vaccineCode.coding.code.first()', type: 'code' },
      { name: 'vaccine_system', path: 'vaccineCode.coding.system.first()', type: 'uri' },
      { name: 'vaccine_display', path: 'vaccineCode.coding.display.first()', type: 'string' },
      { name: 'lot_number', path: 'lotNumber', type: 'string' },
      { name: 'expiration_date', path: 'expirationDate', type: 'date' },
      { name: 'site_code', path: 'site.coding.code.first()', type: 'code' },
      { name: 'route_code', path: 'route.coding.code.first()', type: 'code' },
      { name: 'dose_quantity_value', path: 'doseQuantity.value', type: 'decimal' },
      { name: 'dose_quantity_unit', path: 'doseQuantity.unit', type: 'string' },
      { name: 'performer_practitioner_id', path: `performer.actor.reference.where($this.startsWith('Practitioner/')).substring(13).first()`, type: 'string' },
    ],
  }],
};

const VD_DEVICE_REQUEST = {
  ...viewBase('dsp-device-request', 'dsp_device_request', 'DeviceRequest', 'DSP Device order (DeviceRequest)', 'Flattens DSP device orders before fulfilment.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'intent', path: 'intent', type: 'code' },
      { name: 'priority', path: 'priority', type: 'code' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'encounter_id', path: `encounter.reference.substring(10)`, type: 'string' },
      { name: 'authored_on', path: 'authoredOn', type: 'dateTime' },
      { name: 'code_codeable_system', path: `code.ofType(CodeableConcept).coding.system.first()`, type: 'uri' },
      { name: 'code_codeable_code', path: `code.ofType(CodeableConcept).coding.code.first()`, type: 'code' },
      { name: 'code_codeable_display', path: `code.ofType(CodeableConcept).coding.display.first()`, type: 'string' },
      { name: 'code_reference_device_id', path: `code.ofType(Reference).reference.substring(7)`, type: 'string' },
      { name: 'occurrence_datetime', path: 'occurrence.ofType(dateTime)', type: 'dateTime' },
      { name: 'reason_reference', path: 'reasonReference.reference.first()', type: 'string' },
    ],
  }],
};

const VD_DEVICE = {
  ...viewBase('dsp-device', 'dsp_device', 'Device', 'DSP Device', 'Flattens a physical Device referenced by a DeviceRequest or DeviceUseStatement.'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'manufacturer', path: 'manufacturer', type: 'string' },
      { name: 'model_number', path: 'modelNumber', type: 'string' },
      { name: 'serial_number', path: 'serialNumber', type: 'string' },
      { name: 'udi_carrier', path: 'udiCarrier.carrierHRF.first()', type: 'string' },
      { name: 'type_code', path: 'type.coding.code.first()', type: 'code' },
      { name: 'type_display', path: 'type.coding.display.first()', type: 'string' },
      { name: 'patient_id', path: `patient.reference.substring(8)`, type: 'string' },
    ],
  }],
};

const VD_DEVICE_USE_STATEMENT = {
  ...viewBase('dsp-device-use-statement', 'dsp_device_use_statement', 'DeviceUseStatement', 'DSP DeviceUseStatement', 'Flattens the statement that a patient is using a device (post-dispense signal).'),
  select: [{
    column: [
      ...dspCrossCuttingColumns,
      { name: 'status', path: 'status', type: 'code' },
      { name: 'subject_patient_id', path: `subject.reference.substring(8)`, type: 'string' },
      { name: 'device_id', path: `device.reference.substring(7)`, type: 'string' },
      { name: 'recorded_on', path: 'recordedOn', type: 'dateTime' },
      { name: 'timing_datetime', path: 'timing.ofType(dateTime)', type: 'dateTime' },
      { name: 'timing_period_start', path: 'timing.ofType(Period).start', type: 'dateTime' },
      { name: 'body_site_code', path: 'bodySite.coding.code.first()', type: 'code' },
      { name: 'reason_code', path: 'reasonCode.coding.code.first()', type: 'code' },
    ],
  }],
};

// ====================================================================
// KEY → VIEWS map used by pages & IG zip
// ====================================================================

export const VIEW_DEFINITIONS = {
  // envelope sections
  envelope: [VD_BUNDLE],
  'encounter-block': [VD_ENCOUNTER, VD_PATIENT, VD_PRACTITIONER, VD_ORGANIZATION],
  transcript: [VD_MEDIA, VD_PROVENANCE_SESSION, VD_DOCREF_TRANSCRIPT],
  document: [VD_COMPOSITION, VD_COMPOSITION_SECTION],

  // deep-dive pages
  'document-section': [VD_DOCUMENT_SECTION],
  condition: [VD_CONDITION, VD_CONDITION_CODING],
  medication: [VD_MEDICATION_REQUEST],
  lab: [VD_SR_LAB],
  imaging: [VD_SR_IMAGING],
  procedure: [VD_SR_PROCEDURE],
  referral: [VD_SR_REFERRAL],
  'follow-up': [VD_SR_FOLLOW_UP, VD_APPOINTMENT_FOLLOW_UP],
  dietary: [VD_NUTRITION_ORDER],
  immunization: [VD_IMMUNIZATION_RECOMMENDATION, VD_IMMUNIZATION],
  device: [VD_DEVICE_REQUEST, VD_DEVICE, VD_DEVICE_USE_STATEMENT],
  therapy: [VD_SR_THERAPY, VD_GOAL_THERAPY],
  activity: [VD_CAREPLAN_ACTIVITY, VD_SR_ACTIVITY],
  study: [VD_SR_STUDY, VD_RESEARCH_SUBJECT, VD_RESEARCH_STUDY],
};

// flat list for IG zip emission
export const ALL_VIEW_DEFINITIONS =
  Array.from(new Set(Object.values(VIEW_DEFINITIONS).flat()));
