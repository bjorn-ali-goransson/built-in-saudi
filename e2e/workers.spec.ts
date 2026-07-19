import { test, expect } from '@playwright/test'

// Functional coverage for the #154 worker offload: each test drives a real file
// through the tool and asserts the worker-produced output.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAACf0lEQVR4nAXBwQAAIBAAwQMIIIAAAgjgAAIIIICe+wgggAACCCCAAAI4kGZEBCd4IQhRSIIKWShCFZrQhSFMYQlbOMIVnmCCiMM5vCM4oiM51JEdxVEdzdEdwzEdy7Edx3Edz2EOEY/zeE/wRE/yqCd7iqd6mqd7hmd6lmd7jud6nsc8IgEX8IEQiIEU0EAOlEANtEAPjMAMrMAOnMANvIAFRCIu4iMhEiMpopEcKZEaaZEeGZEZWZEdOZEbeRGLiCRcwidCIiZSQhM5URI10RI9MRIzsRI7cRI38RKWEFGc4pWgRCUpqmSlKFVpSleGMpWlbOUoV3mKKSIZl/GZkImZlNFMzpRMzbRMz4zMzKzMzpzMzbyMZUQKruALoRALqaCFXCiFWmiFXhiFWViFXTiFW3gFK4hUXMVXQiVWUkUruVIqtdIqvTIqs7Iqu3Iqt/IqVhFpuIZvhEZspIY2cqM0aqM1emM0ZmM1duM0buM1rCHScR3fCZ3YSR3t5E7p1E7r9M7ozM7q7M7p3M7rWEdk4AZ+EAZxkAY6yIMyqIM26IMxmIM12IMzuIM3sIHIxE38JEziJE10kidlUidt0idjMidrsidncidvYhORhVv4RVjERVroIi/Koi7aoi/GYi7WYi/O4i7ewhYiG7fxm7CJm7TRTd6UTd20Td+Mzdyszd6czd28jW1EDu7gD+EQD+mgh3woh3poh34Yh3lYh304h3t4BzuIXNzFX8IlXtJFL/lSLvXSLv0yLvOyLvtyLvfyLnYRebiHf4RHfKSHPvKjPOqjPfpjPOZjPfbjPO7jPewhYjjDG8GIRjLUyEYxqtGMbgxjGsvYxjGu8QwzPsfjLF9mkRmmAAAAAElFTkSuQmCC',
  'base64',
)
const file = { name: 'tiny.png', mimeType: 'image/png', buffer: PNG }

test('image compressor encodes via the worker', async ({ page }) => {
  await page.goto('/en/apps/image-compressor')
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByTestId('imgcomp-result')).toBeVisible()
})

test('format converter converts via the worker', async ({ page }) => {
  await page.goto('/en/apps/image-format-converter')
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByTestId('ifc-result')).toBeVisible()
})

test('cropper produces output via the worker', async ({ page }) => {
  await page.goto('/en/apps/image-cropper')
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByTestId('crop-result')).toBeVisible()
})

test('steganography hides and reveals via the worker', async ({ page }) => {
  await page.goto('/en/apps/steganography')
  await page.setInputFiles('input[type=file]', file)
  await page.getByTestId('stego-message').fill('hi')
  const dl = page.waitForEvent('download')
  await page.getByTestId('stego-embed').click()
  const download = await dl
  // saveAs with a .png suffix so the re-upload gets an image/png mime type
  const path = `${await download.path()}.png`
  await download.saveAs(path)
  // round-trip: reveal the message from the downloaded PNG
  await page.getByTestId('stego-reveal').click()
  await page.setInputFiles('input[type=file]', path)
  await expect(page.getByTestId('stego-revealed')).toHaveValue('hi')
})

test('zip inspector lists entries via the worker', async ({ page }) => {
  // minimal zip: one stored file "a.txt" containing "hi"
  const zip = Buffer.from(
    'UEsDBAoAAAAAAFB381ysKpPYAgAAAAIAAAAFABwAYS50eHRVVAkAA/fJXGr3yVxqdXgLAAEE6AMAAAToAwAAaGlQSwECHgMKAAAAAABQd/NcrCqT2AIAAAACAAAABQAYAAAAAAABAAAAtIEAAAAAYS50eHRVVAUAA/fJXGp1eAsAAQToAwAABOgDAABQSwUGAAAAAAEAAQBLAAAAQQAAAAAA',
    'base64',
  )
  await page.goto('/en/apps/archive-inspector')
  await page.setInputFiles('input[type=file]', { name: 't.zip', mimeType: 'application/zip', buffer: zip })
  await expect(page.getByTestId('zip-format')).toHaveText('ZIP')
  await expect(page.getByTestId('zip-list')).toContainText('a.txt')
})

test('hash generator hashes a file via the worker', async ({ page }) => {
  await page.goto('/en/apps/hash-generator')
  await page.getByTestId('hash-mode-file').click()
  await page.setInputFiles('input[type=file]', { name: 'abc.txt', mimeType: 'text/plain', buffer: Buffer.from('abc') })
  await expect(page.getByTestId('hash-hex')).toHaveText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
