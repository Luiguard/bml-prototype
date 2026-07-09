import fitz
import sys

def test_redaction(input_pdf, output_pdf):
    doc = fitz.open(input_pdf)
    page = doc[1] # Page 2 usually has text over image in this doc

    # Find some text to redact
    text_instances = page.search_for("Dior")
    for inst in text_instances:
        # Add redaction annotation
        page.add_redact_annot(inst, fill=None)

    # Apply redactions, preserving images
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

    doc.save(output_pdf)
    print("Saved to", output_pdf)

if __name__ == "__main__":
    test_redaction("uploads/uqjcxzo8qll.pdf", "outputs/test_redaction.pdf")
