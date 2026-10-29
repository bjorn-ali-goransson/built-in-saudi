// The text parts of a ZIP — the ODF formats are ZIPs without OPC's
// [Content_Types].xml, so they cannot go through opc.Package.
import { readZipText } from '../../../lib/unzip'
export async function unzipText(buf: ArrayBuffer, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  return readZipText(buf, wanted)
}
