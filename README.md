# Gotcha!Mark

**Watermark PDFs per-recipient, helps you trace leaks back to their source.**

You've sent your passport to a bank. Your blood tests to a clinic. Your CV (with your phone number and home address) to a dozen companies. You had no choice: they asked, you complied.

Some of those organizations will get breached. A clerk will click the wrong link. A server will go unpatched for six months. A disgruntled employee will copy the wrong folder on their way out.

It's not a question of if. It's when.

When it happens, your documents will end up on the dark web. You won't be notified. You won't find out for months, maybe years. And you'll have no idea who was responsible.

**Gotcha!Mark** doesn't stop leaks. But when your data surfaces, it tells you exactly who you gave that copy to — and where the chain of responsibility starts.

Oh, and if you're a security researcher who routinely investigates data breaches and dump analysis, [there's a section for you below](#for-security-researchers).

> Works fully offline. No cloud, no accounts, no external services.

---

## Download

Grab the latest Windows installer from the [Releases page](https://github.com/sambucci/gotchamark/releases).

Pre-built installers for macOS and Linux are coming. In the meantime, the source should build on both platforms via `npm run tauri build` — the codebase has no Windows-specific dependencies — but this is untested. See [Building from source](#building-from-source) below.

---

## How it works

1. **Watermark** — open a PDF, fill in the recipient's details, and save a personalised copy. Each copy gets a unique mark printed directly on the page.
2. **Trace** — if a copy leaks, read the watermark. The recipient name and mark ID tell you exactly which copy it was. Search the mark ID in the History tab to pull up the full record.
3. **Registry** — every watermark you've ever issued is stored locally in a searchable log.

---

## Features

- Visible text watermarks — small, positioned where you choose, embedded in the PDF structure
- Per-recipient fields: name, date, custom note, unique ID
- Adjustable font, colour, and position
- Local registry with full-text search across recipient, date, mark ID, and custom fields
- Fully offline — no internet connection required
- Multi-language UI: English / Italian

---

## System requirements

| | Minimum |
|---|---|
| **Windows** | Windows 10 (64-bit) |
| **macOS** | macOS 11 Big Sur (untested — build from source) |
| **Linux** | WebKit2GTK required (untested — build from source) |

---

## For security researchers

Every GotchaMark'd PDF carries three independent signals. If you're scanning a large dataset or breach dump, any of these will find the needle:

```bash
# grep on raw bytes — no tools needed, works on any OS
# XMP signal (survives most PDF processing pipelines)
grep -rl "gotchamark:MarkID" /path/to/dump/

# Info dict signal
grep -rl "GotchaMark-ID" /path/to/dump/

# Visible watermark text in the content stream
grep -rl "gotchamark.net" /path/to/dump/
```

```bash
# ExifTool — extracts XMP fields by namespace URI
exiftool -r -xmp-gotchamark:all /path/to/dump/
```

```python
# Python + pikepdf — structured extraction of both signals
import pikepdf, pathlib

for path in pathlib.Path("/path/to/dump").rglob("*.pdf"):
    try:
        with pikepdf.open(path) as pdf:
            mark_id = pdf.docinfo.get("/GotchaMark-ID")
            if not mark_id:
                # Fallback: scan raw bytes for XMP signal
                raw = path.read_bytes()
                start = raw.find(b"<gotchamark:MarkID>")
                if start >= 0:
                    end = raw.find(b"</gotchamark:MarkID>", start)
                    mark_id = raw[start+19:end].decode()
            if mark_id:
                print(f"{path}\t{mark_id}")
    except Exception:
        pass
```

Once you have a mark ID (e.g. `GM-C28VY-BF13E70C`), the visible watermark text on the PDF will tell you who the document was sent to — that's the recipient information printed directly on each copy. The mark ID is the link back to the source: if you can reach the document's owner, they can look it up in their registry to identify exactly which copy was leaked and to whom.

The XMP metadata uses the namespace `https://gotchamark.net/xmp/1.0/` with two properties:
- `gotchamark:MarkID` — the unique watermark ID
- `gotchamark:Version` — schema version (currently `1`)

---

## Limitations

Gotcha!Mark is a tracing tool, not a security guarantee. Know what it can and cannot do before you rely on it.

**The watermark can be removed.** It is visible text embedded in the PDF. A determined recipient can strip it — by cropping the area, overlaying a white rectangle, printing to paper and rescanning, or reconstructing the content without the file. The watermark is a deterrent and a paper trail, not a lock.

**It identifies the recipient copy, not the leaker.** If the copy sent to person A ends up online, you know person A received that copy. You don't know whether A leaked it, or whether someone else — an employee, a contractor, a data processor managing A's records on A's behalf — did. The watermark starts the chain — it doesn't close it, and it doesn't identify the breached party.

**The watermark is tied to your registry.** If someone else watermarked the document, or you're on a different machine without your registry, reading the mark ID off the page tells you nothing beyond what's printed on it.

**A visible watermark can be worked around.** Someone who knows the document is marked can avoid forwarding the file digitally and instead retype, photograph, or summarise the content. The information leaks; the mark doesn't travel with it.

**The contrast check has limits.** Gotcha!Mark refuses to apply a watermark that would be invisible against the sampled background — white text on a white page, for example. But it only samples the background at the placement area on the first page. If the document has pages with different backgrounds, a watermark that's clearly visible on page 1 may become invisible on later pages. Choose a colour that works across the whole document.

**The registry is local and unwitnessed.** The log lives on your machine and is only as trustworthy as your machine. It is not a notarised record and cannot by itself serve as legal evidence of anything.

---

## Building from source

See [CONTRIBUTING.md](./CONTRIBUTING.md) for prerequisites and build instructions.

---

## Licence

GNU General Public License v3.0 — see [LICENSE](./LICENSE).

You can use, study, share and modify this software freely. Any distributed version — including modified versions — must remain open source under the same licence.
