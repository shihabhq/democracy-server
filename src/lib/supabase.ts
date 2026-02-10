/**
 * Supabase Storage for certificates.
 * Set in .env:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *   SUPABASE_CERTIFICATES_BUCKET=certificates  (optional; default "certificates")
 * Bucket must be public so download URLs work.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getEnv() {
  return {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    certificatesBucket:
      process.env.SUPABASE_CERTIFICATES_BUCKET ?? "certificates",
  };
}

export function getSupabase(): SupabaseClient | null {
  const { supabaseUrl, supabaseServiceKey } = getEnv();

  if (!supabaseUrl || !supabaseServiceKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export function isSupabaseStorageConfigured(): boolean {
  const { supabaseUrl, supabaseServiceKey } = getEnv();
  return !!(supabaseUrl && supabaseServiceKey);
}

/**
 * Upload certificate PDF to Supabase Storage (public bucket).
 * Returns the public URL to the file, or null if Supabase is not configured.
 */
export async function uploadCertificateToSupabase(
  attemptId: string,
  pdfBuffer: Buffer,
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const { certificatesBucket } = getEnv();
  const filePath = `${attemptId}.pdf`;

  const { data, error } = await supabase.storage
    .from(certificatesBucket)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(certificatesBucket)
    .getPublicUrl(filePath);
  return urlData.publicUrl;
}
