import { useRef, useState, type ChangeEvent } from 'react'
import { Upload, X, FileText, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface FileUploadProps {
  onUpload: (url: string, fileName: string) => void
  accept?: string
  bucket?: string
  path?: string
  existingUrl?: string
  label?: string
}

export function FileUpload({
  onUpload, accept = 'image/*,.pdf', bucket = 'payments-proofs',
  path = 'proofs', existingUrl, label = 'Upload Proof',
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${path}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath)
      setFileName(file.name)
      onUpload(publicUrl, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const hasFile = fileName || existingUrl

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors cursor-pointer',
          hasFile ? 'border-brand-teal/50 bg-teal-500/10' : 'border-brand-border hover:border-brand-teal/50',
        )}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
        {uploading ? (
          <svg className="animate-spin h-4 w-4 text-brand-teal flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : hasFile ? (
          <Check size={16} className="text-brand-teal flex-shrink-0" />
        ) : (
          <Upload size={16} className="text-slate-500 flex-shrink-0" />
        )}
        <span className="text-xs text-slate-400 truncate">
          {uploading ? 'Uploading...' : fileName ?? (existingUrl ? 'File attached' : 'Click to upload (optional)')}
        </span>
        {hasFile && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFileName(null); onUpload('', '') }}
            className="ml-auto text-slate-500 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
