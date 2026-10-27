-- =============================================================================
-- Zentravo — tax document immutability (idempotent, safe to re-run)
--
-- Finalized FISCAL documents may never be edited or deleted: corrections are made
-- with a credit / debit note. Only the annotation columns below may change after
-- finalization (e-invoicing status and the input-VAT eligibility review).
--
-- Test / maintenance bypass (per transaction only):
--     SET LOCAL zentravo.allow_tax_doc_mutation = 'on';
-- =============================================================================

CREATE OR REPLACE FUNCTION zentravo_protect_tax_documents() RETURNS trigger AS $$
DECLARE
  mutable_cols text[] := ARRAY[
    'irdStatus', 'externalReference',
    'inputVatEligibility', 'inputVatReviewedById', 'inputVatReviewedAt', 'inputVatReviewNote'
  ];
BEGIN
  IF current_setting('zentravo.allow_tax_doc_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'FINALIZED' AND OLD."documentType" NOT IN ('QUOTATION', 'PROFORMA_INVOICE') THEN
      RAISE EXCEPTION 'Finalized tax document % cannot be deleted. Issue a credit note instead.', OLD."documentNumber"
        USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD."status" = 'FINALIZED' THEN
    -- Non-fiscal documents (quotations / proforma invoices) may be cancelled
    IF OLD."documentType" IN ('QUOTATION', 'PROFORMA_INVOICE') AND NEW."status" = 'CANCELLED' THEN
      RETURN NEW;
    END IF;
    IF (to_jsonb(NEW) - mutable_cols) IS DISTINCT FROM (to_jsonb(OLD) - mutable_cols) THEN
      RAISE EXCEPTION 'Finalized tax document % cannot be modified. Issue a credit or debit note instead.', OLD."documentNumber"
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zentravo_tax_documents_immutable ON "tax_documents";
CREATE TRIGGER zentravo_tax_documents_immutable
  BEFORE UPDATE OR DELETE ON "tax_documents"
  FOR EACH ROW EXECUTE FUNCTION zentravo_protect_tax_documents();

CREATE OR REPLACE FUNCTION zentravo_protect_tax_document_lines() RETURNS trigger AS $$
DECLARE
  parent_status text;
  parent_number text;
  parent_type text;
  doc_id text;
BEGIN
  IF current_setting('zentravo.allow_tax_doc_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN doc_id := OLD."documentId"; ELSE doc_id := NEW."documentId"; END IF;

  SELECT "status"::text, "documentNumber", "documentType"::text INTO parent_status, parent_number, parent_type
    FROM "tax_documents" WHERE "id" = doc_id;

  -- Parent already gone (cascade from a DRAFT delete) or still a draft → allowed.
  IF parent_status = 'FINALIZED' AND parent_type NOT IN ('QUOTATION', 'PROFORMA_INVOICE') THEN
    RAISE EXCEPTION 'Lines of finalized tax document % cannot be changed. Issue a credit or debit note instead.', parent_number
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zentravo_tax_document_lines_immutable ON "tax_document_lines";
CREATE TRIGGER zentravo_tax_document_lines_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "tax_document_lines"
  FOR EACH ROW EXECUTE FUNCTION zentravo_protect_tax_document_lines();
