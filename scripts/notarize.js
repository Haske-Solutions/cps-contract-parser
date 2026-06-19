const { notarize } = require('@electron/notarize')

/**
 * macOS notarization hook for electron-builder.
 * Skipped automatically when signing credentials are not present (local unsigned builds).
 *
 * Required env vars for release builds:
 *   APPLE_ID
 *   APPLE_APP_SPECIFIC_PASSWORD
 *   APPLE_TEAM_ID
 *   CSC_LINK or CSC_NAME (Developer ID certificate)
 */
exports.default = async function notarizeMac(context) {
  if (process.platform !== 'darwin') return
  if (context.electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID, CSC_LINK, CSC_NAME } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn('[notarize] Skipping — Apple notarization env vars not set.')
    return
  }
  if (!CSC_LINK && !CSC_NAME) {
    console.warn('[notarize] Skipping — code signing certificate not configured.')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`

  console.log(`[notarize] Notarizing ${appPath}`)
  await notarize({
    appBundleId: 'com.chelipeacock.contract-parser',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  })
  console.log('[notarize] Notarization complete.')
}
