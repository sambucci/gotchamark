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

macOS and Linux builds are coming. In the meantime, see [Building from source](#building-from-source) below.

---

## How it works

1. **Watermark** — open a PDF, fill in the recipient's details, and save a personalised copy. Each copy gets a unique mark printed directly on the page.
2. **Trace** — if a copy leaks, read the watermark. The recipient name and mark ID tell you exactly which copy it was. Search the mark ID in the History tab to pull up the full record.
3. **Registry** — every watermark you've ever issued is stored locally in a searchable log.

---

## Features

- Visible text watermarks — small, unobtrusive, hard to strip without damaging the document
- Per-recipient fields: name, date, custom note, unique ID
- Adjustable font, colour, opacity, and position
- Leak tracing: read the watermark on any leaked copy, look up the mark ID in History
- Full local registry with search
- Fully offline — no internet connection required
- Multi-language UI: English / Italian

---

## System requirements

| | Minimum |
|---|---|
| **Windows** | Windows 10 (64-bit) |
| **macOS** | macOS 11 Big Sur |
| **Linux** | Any modern distro with WebKit2GTK |

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
# ExifTool — extracts the mark ID directly from XMP
exiftool -r -GotchaMark:all /path/to/dump/
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

## Building from source

See [CONTRIBUTING.md](./CONTRIBUTING.md) for prerequisites and build instructions.

---

## Licence

GNU General Public License v3.0 — see [LICENSE](./LICENSE).

You can use, study, share and modify this software freely. Any distributed version — including modified versions — must remain open source under the same licence.
