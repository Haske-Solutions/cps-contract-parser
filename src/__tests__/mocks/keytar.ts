export async function getPassword(): Promise<string | null> {
  return null
}

export async function setPassword(): Promise<void> {}

export async function deletePassword(): Promise<boolean> {
  return true
}

export async function findCredentials(): Promise<Array<{ account: string; password: string }>> {
  return []
}
