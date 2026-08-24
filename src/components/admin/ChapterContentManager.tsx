"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Plus,
  Edit,
  Trash2,
  Video,
  FileText,
  Link,
  Image,
  File
} from "lucide-react";
import { FileUploadZone } from "./FileUploadZone";
import { toast } from "../ui/toast";
import { confirmDialog } from "../ui/confirm-dialog";
import { generateUUID } from "../../lib/uuid-utils";

export interface ChapterContent {
  id?: string;
  content_id?: string;
  chapter_id: string;
  content_type: 'text' | 'video' | 'video_link' | 'pdf' | 'image' | 'file' | 'audio' | 'html' | 'link';
  title: string;
  content_text?: string;
  content_url?: string;
  order_index?: number;
  storage_path?: string;
  duration_minutes?: number;
  content_metadata?: Record<string, unknown>;
}

interface ChapterContentManagerProps {
  chapterId: string;
  chapterName: string;
  contents: ChapterContent[];
  onContentsChange: (contents: ChapterContent[]) => void;
  courseId?: string;
  disabled?: boolean;
  onVideoAdded?: (video: { chapter_id: string; title: string; video_url: string; duration?: number }) => void;
  /** Renders without its own outer Card/title chrome when nested inside a parent
   * that already shows the chapter name (e.g. ChapterBuilderCard) — avoids
   * repeating the chapter name and stacking redundant card borders. */
  embedded?: boolean;
}

type ContentType = 'text' | 'video' | 'video_link' | 'pdf' | 'image' | 'file' | 'link';

export function ChapterContentManager({
  chapterId,
  chapterName,
  contents,
  onContentsChange,
  courseId,
  disabled = false,
  onVideoAdded,
  embedded = false,
}: ChapterContentManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<ChapterContent | null>(null);
  const [contentType, setContentType] = useState<ContentType>('text');
  const [linkType, setLinkType] = useState<'video' | 'material'>('material'); // New state for link type selection
  const [formData, setFormData] = useState({
    title: '',
    content_text: '',
    content_url: '',
    duration_minutes: '',
  });

  const sortedContents = [...contents].sort((a: ChapterContent, b: ChapterContent) => (a.order_index ?? 0) - (b.order_index ?? 0));

  // Validate and detect link type
  const detectLinkType = (url: string): 'video_link' | 'link' => {
    if (!url) return 'link';
    
    const lowerUrl = url.toLowerCase();
    
    // Check for YouTube links
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('youtube.com/embed')) {
      return 'video_link';
    }
    
    // Check for drive links
    if (lowerUrl.includes('drive.google.com') || 
        lowerUrl.includes('onedrive.live.com') || 
        lowerUrl.includes('1drv.ms') ||
        lowerUrl.includes('dropbox.com') ||
        lowerUrl.includes('docs.google.com')) {
      return 'link';
    }
    
    // Default to link for any other URL
    return 'link';
  };

  // Validate drive link format
  const validateDriveLink = (url: string): { valid: boolean; message?: string } => {
    if (!url.trim()) {
      return { valid: false, message: 'URL is required' };
    }

    try {
      new URL(url); // Basic URL validation
    } catch {
      return { valid: false, message: 'Invalid URL format' };
    }

    const lowerUrl = url.toLowerCase();
    
    // Google Drive validation
    if (lowerUrl.includes('drive.google.com')) {
      if (!lowerUrl.includes('/file/d/') && !lowerUrl.includes('/open?id=') && !lowerUrl.includes('/folders/')) {
        return { valid: true, message: 'Note: Make sure the Google Drive file/folder is set to "Anyone with the link can view"' };
      }
    }
    
    // OneDrive validation
    if (lowerUrl.includes('onedrive.live.com') || lowerUrl.includes('1drv.ms')) {
      return { valid: true, message: 'Note: Make sure the OneDrive file is set to "Anyone with the link can view"' };
    }
    
    // Dropbox validation
    if (lowerUrl.includes('dropbox.com')) {
      return { valid: true, message: 'Note: Make sure the Dropbox file is set to "Anyone with the link can view"' };
    }

    return { valid: true };
  };

  const openDialog = (type: ContentType, content?: ChapterContent) => {
    setContentType(type);
    if (content) {
      setEditingContent(content);
      // Detect link type from existing content
      if (type === 'link' || type === 'video_link') {
        setLinkType(content.content_type === 'video_link' ? 'video' : 'material');
      }
      setFormData({
        title: content.title || '',
        content_text: content.content_text || '',
        content_url: content.content_url || '',
        duration_minutes: content.duration_minutes?.toString() || '',
      });
    } else {
      setEditingContent(null);
      // Reset link type to default when adding new link
      if (type === 'link') {
        setLinkType('material');
      }
      setFormData({
        title: '',
        content_text: '',
        content_url: '',
        duration_minutes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingContent(null);
    setLinkType('material'); // Reset link type
    setFormData({
      title: '',
      content_text: '',
      content_url: '',
      duration_minutes: '',
    });
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.warning('Title is required');
      return;
    }

    // For link type, use the selected link type (video or material)
    let finalContentType = contentType;
    if ((contentType as string) === 'link') {
      // Use the selected link type instead of auto-detection
      finalContentType = linkType === 'video' ? 'video_link' : 'link';
    } else if ((contentType as string) === 'link' && formData.content_url) {
      // Fallback to auto-detection if linkType not set (for backward compatibility)
      const detectedType = detectLinkType(formData.content_url);
      finalContentType = detectedType;
    }

    // Validate drive links
    if (finalContentType === 'link' && formData.content_url) {
      const validation = validateDriveLink(formData.content_url);
      if (!validation.valid) {
        toast.warning(validation.message || 'Invalid link format');
        return;
      }
    }

    // Validate video links require URL
    if (finalContentType === 'video_link' && !formData.content_url.trim()) {
      toast.warning('Video URL is required');
      return;
    }

    // `id` and `content_id` must always match — some call sites read one,
    // some the other. Generating them separately (crypto.randomUUID() twice)
    // meant every new item had two different ids; also crypto.randomUUID()
    // itself is undefined outside a secure context (plain-http LAN/staging),
    // so it's routed through the app's guarded generateUUID() fallback.
    const contentUuid = editingContent?.id || editingContent?.content_id || generateUUID();
    const newContent: ChapterContent = {
      ...(editingContent || {}),
      id: contentUuid,
      content_id: contentUuid,
      chapter_id: chapterId,
      content_type: finalContentType,
      title: formData.title.trim(),
      content_text: finalContentType === 'text' ? formData.content_text : undefined,
      // For link/video_link the URL/duration come from the form fields below.
      // Every other type (file/pdf/image/video uploaded via FileUploadZone)
      // has no such fields in this dialog — this save path only runs for a
      // title/description-only edit of an already-uploaded item (a fresh
      // upload bypasses this entirely via handleFileUpload), so it must keep
      // whatever URL/duration the item already had instead of blanking them.
      content_url: ['video_link', 'link'].includes(finalContentType)
        ? formData.content_url.trim()
        : editingContent?.content_url,
      duration_minutes: finalContentType === 'video_link'
        ? (formData.duration_minutes ? Math.round(parseFloat(formData.duration_minutes)) : undefined)
        : editingContent?.duration_minutes,
      order_index: editingContent?.order_index || (contents.length > 0 ? Math.max(...contents.map((c: ChapterContent) => c.order_index ?? 0)) + 1 : 1),
    };

    // If it's a NEW video link, also notify parent to add it to the videos
    // table. Gated on !editingContent: onVideoAdded is append-only (no id,
    // no matching update path in either caller), so firing it on every edit
    // of an existing video link — even just a title change — kept appending
    // duplicate rows for the same video.
    if (!editingContent && finalContentType === 'video_link' && onVideoAdded && formData.content_url.trim()) {
      onVideoAdded({
        chapter_id: chapterId,
        title: formData.title.trim(),
        video_url: formData.content_url.trim(),
        duration: formData.duration_minutes ? Math.round(parseFloat(formData.duration_minutes)) : undefined,
      });
    }

    if (editingContent) {
      const editingId = editingContent.id || editingContent.content_id;
      onContentsChange(contents.map((c: ChapterContent) => {
        const cId = c.id || c.content_id;
        return cId === editingId ? newContent : c;
      }));
    } else {
      onContentsChange([...contents, newContent]);
    }

    closeDialog();
  };

  const handleDelete = async (contentId: string | undefined) => {
    if (!contentId) {
      console.warn('Cannot delete: content ID is missing');
      toast.error('Cannot delete content. Missing content ID.');
      return;
    }

    if (await confirmDialog({
      title: 'Delete this content?',
      description: 'This content will be removed from the chapter.',
      confirmText: 'Delete',
      variant: 'danger',
    })) {
      const updatedContents = contents.filter((c: ChapterContent) => {
        const cId = c.id || c.content_id;
        // Also check by title as fallback if IDs don't match
        if (!cId && contentId) {
          // If content doesn't have ID, skip it (shouldn't happen with new code)
          return true;
        }
        return cId !== contentId;
      });
      
      console.log('Deleting content:', {
        contentId,
        beforeCount: contents.length,
        afterCount: updatedContents.length,
        contents: contents.map((c: ChapterContent) => ({ id: c.id, content_id: c.content_id, title: c.title }))
      });
      
      if (updatedContents.length === contents.length) {
        console.error('Delete failed: Content not found', { contentId, contents });
        toast.error('Content not found. It may have already been deleted.');
        return;
      }
      
      onContentsChange(updatedContents);
      console.log('✅ Content deleted successfully:', contentId);
    }
  };

  const handleFileUpload = (fileUrl: string, filePath?: string, originalFileName?: string) => {
    // The backend stores uploads under a generated UUID name, so `filePath`/`fileUrl`
    // no longer contain anything human-readable — prefer the original browser
    // File object's name (threaded through from FileUploadZone) as the default
    // title, falling back to parsing the URL only if it's somehow unavailable.
    const sourceForName = filePath || fileUrl;
    const fileName = originalFileName || sourceForName.split('/').pop() || 'Uploaded file';
    // Determine content type based on file extension
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    let detectedContentType: ChapterContent['content_type'] = 'file';
    if (fileExtension === 'pdf') {
      detectedContentType = 'pdf';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '')) {
      detectedContentType = 'image';
    } else if (['mp4', 'mov', 'avi', 'webm'].includes(fileExtension || '')) {
      detectedContentType = 'video';
    } else if (['mp3', 'wav', 'ogg'].includes(fileExtension || '')) {
      detectedContentType = 'audio';
    }
    
    // Prefer whatever the admin typed into the Title field before uploading —
    // it was previously always clobbered by the raw uploaded file name.
    const title = formData.title.trim() || fileName;

    // Reuse the item's existing id when this upload is replacing the file on
    // an item already being edited — otherwise it silently duplicated the
    // row (new item appended, stale original left behind) instead of
    // replacing it.
    const contentUuid = editingContent?.id || editingContent?.content_id || generateUUID();
    const newContent: ChapterContent = {
      id: contentUuid,
      content_id: contentUuid,
      chapter_id: chapterId,
      content_type: contentType === 'pdf' ? 'pdf' : contentType === 'image' ? 'image' : detectedContentType,
      title,
      content_url: fileUrl,
      storage_path: filePath || undefined, // Save storage_path from upload response
      order_index: editingContent?.order_index
        ?? (contents.length > 0 ? Math.max(...contents.map((c: ChapterContent) => c.order_index ?? 0)) + 1 : 1),
    };
    console.log('✅ File uploaded and added to chapter contents:', {
      title,
      fileUrl,
      storage_path: filePath,
      content_type: newContent.content_type
    });
    if (editingContent) {
      const editingId = editingContent.id || editingContent.content_id;
      onContentsChange(contents.map((c: ChapterContent) => {
        const cId = c.id || c.content_id;
        return cId === editingId ? newContent : c;
      }));
    } else {
      onContentsChange([...contents, newContent]);
    }
    closeDialog(); // Close dialog after successful upload
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video':
      case 'video_link':
        return Video;
      case 'text':
        return FileText;
      case 'pdf':
        return File;
      case 'image':
        return Image;
      case 'link':
        return Link;
      case 'file':
        return File;
      default:
        return File;
    }
  };

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'video_link':
        return 'Video Link';
      case 'text':
        return 'Text';
      case 'pdf':
        return 'PDF';
      case 'image':
        return 'Image';
      case 'link':
        return 'Link';
      case 'file':
        return 'Material';
      default:
        return 'File';
    }
  };

  const actionButtons = !disabled && (
    <div className="flex flex-wrap gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => openDialog('text')}
        className="h-8 border-gray-200 text-xs font-medium text-gray-700"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Text
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openDialog('link');
        }}
        className="h-8 border-gray-200 text-xs font-medium text-gray-700"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Link
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => openDialog('file')}
        className="h-8 border-gray-200 text-xs font-medium text-gray-700"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Material
      </Button>
    </div>
  );

  const contentListAndDialog = (
    <>
      {sortedContents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center">
            <p className="text-sm text-gray-500">No content yet</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Add text, a link, or upload material to build out this chapter.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
          {sortedContents.map((content, index) => {
            const Icon = getContentIcon(content.content_type);
            return (
              <div
                key={content.id || content.content_id || index}
                className="group/item flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300 hover:bg-gray-50/60"
              >
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-medium text-gray-900">{content.title}</h4>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {getContentTypeLabel(content.content_type)}
                    {content.duration_minutes ? (
                      <>
                        <span className="mx-1.5 text-gray-300">•</span>
                        {content.duration_minutes} min
                      </>
                    ) : null}
                  </p>
                  {content.content_text && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                      {content.content_text}
                    </p>
                  )}
                  {content.content_url && !content.content_text && (
                    <a
                      href={content.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-xs text-gray-400 hover:text-blue-600 hover:underline"
                      title={content.content_url}
                    >
                      {content.content_url}
                    </a>
                  )}
                </div>
                {!disabled && (
                  <div className="flex flex-shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openDialog(content.content_type as ContentType, content)}
                      title="Edit content"
                      aria-label="Edit content"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Get the content ID - try multiple sources
                        const contentId = content.id || content.content_id;
                        
                        if (contentId) {
                          // Use the ID-based delete
                          handleDelete(contentId);
                        } else {
                          // Fallback: Find by matching properties and delete by index
                          console.warn('Content missing ID, using property matching as fallback:', content);
                          const contentIndex = sortedContents.findIndex(c => 
                            c.title === content.title && 
                            c.content_type === content.content_type &&
                            c.chapter_id === content.chapter_id &&
                            (c.content_text === content.content_text || c.content_url === content.content_url)
                          );
                          
                          if (contentIndex >= 0) {
                            // Remove from sorted contents and update
                            const _updatedSorted = sortedContents.filter((_, idx) => idx !== contentIndex);
                            // Convert back to original order and update
                            const updatedContents = contents.filter((c: ChapterContent) => {
                              const cTitle = c.title;
                              const cType = c.content_type;
                              const cChapterId = c.chapter_id;
                              const cText = c.content_text;
                              const cUrl = c.content_url;
                              
                              return !(cTitle === content.title && 
                                      cType === content.content_type &&
                                      cChapterId === content.chapter_id &&
                                      (cText === content.content_text || cUrl === content.content_url));
                            });
                            
                            onContentsChange(updatedContents);
                            console.log('✅ Content deleted using property matching fallback');
                          } else {
                            console.error('Cannot delete: content not found', { content, contents: contents.map((c: ChapterContent) => ({ id: c.id, content_id: c.content_id, title: c.title })) });
                            toast.error('Cannot delete this content. Please refresh the page and try again.');
                          }
                        }
                      }}
                      title="Delete content"
                      aria-label="Delete content"
                      className="h-8 w-8 p-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}

        {/* Add Content Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="grid max-h-[85vh] w-[calc(100vw-2rem)] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader className="border-b px-6 pt-6 pb-4">
              <DialogTitle>
                {editingContent ? 'Edit' : 'Add'} {getContentTypeLabel(contentType)}
              </DialogTitle>
              <DialogDescription>
                {contentType === 'text' && 'Add text content to this chapter'}
                {contentType === 'video_link' && 'Add a link to a video (e.g., YouTube)'}
                {contentType === 'link' && 'Add a link to external content (Google Drive, OneDrive, Dropbox, etc.)'}
                {contentType === 'file' && 'Upload chapter materials (PPT, PDF, DOC, TXT, etc.)'}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="content-title">Title *</Label>
                <Input
                  id="content-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter content title"
                />
              </div>

              {contentType === 'text' && (
                <div>
                  <Label htmlFor="content-text">Content</Label>
                  <Textarea
                    id="content-text"
                    value={formData.content_text}
                    onChange={(e) => setFormData({ ...formData, content_text: e.target.value })}
                    placeholder="Enter text content"
                    rows={6}
                  />
                </div>
              )}

              {(contentType === 'video_link' || contentType === 'link') && (
                <>
                  {contentType === 'link' && (
                    <div>
                      <Label htmlFor="link-type">Link Type *</Label>
                      <Select value={linkType} onValueChange={(value: 'video' | 'material') => setLinkType(value)}>
                        <SelectTrigger id="link-type">
                          <SelectValue placeholder="Select link type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video">
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4" />
                              Video Link
                            </div>
                          </SelectItem>
                          <SelectItem value="material">
                            <div className="flex items-center gap-2">
                              <Link className="h-4 w-4" />
                              Material Link
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        {linkType === 'video' 
                          ? 'This link will be saved as a video and counted in the video count'
                          : 'This link will be saved as a material link'}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="content-url">URL *</Label>
                    <Input
                      id="content-url"
                      type="url"
                      value={formData.content_url}
                      onChange={(e) => {
                        const url = e.target.value;
                        setFormData({ ...formData, content_url: url });
                        // Auto-detect link type if it's a link dialog and no type selected yet
                        if (contentType === 'link' && url && linkType === 'material') {
                          const detectedType = detectLinkType(url);
                          if (detectedType === 'video_link') {
                            // Suggest changing to video type
                            console.log('Detected video link, consider selecting "Video Link" type');
                          }
                        }
                      }}
                      placeholder={contentType === 'video_link' || (contentType === 'link' && linkType === 'video')
                        ? "https://www.youtube.com/watch?v=..." 
                        : "https://drive.google.com/file/d/... or any drive link"}
                    />
                    {contentType === 'link' && linkType === 'material' && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-600">
                          Supported: Google Drive, OneDrive, Dropbox, or any shareable link
                        </p>
                        {formData.content_url && (
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                            <p className="font-medium mb-1">⚠️ Important:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              <li>Make sure the file/folder is set to &quot;Anyone with the link can view&quot;</li>
                              <li>For Google Drive: Right-click file → Share → Change to &quot;Anyone with the link&quot;</li>
                              <li>For OneDrive: Right-click file → Share → Set permission to &quot;Anyone&quot;</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {(contentType === 'video_link' || (contentType === 'link' && linkType === 'video')) && (
                      <p className="text-xs text-gray-500 mt-1">
                        Supports: YouTube, Vimeo, and other video platforms
                      </p>
                    )}
                  </div>
                </>
              )}

              {contentType === 'video_link' && (
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  {/* Whole minutes only — the column is an Int, and the old
                      step="0.1" / "e.g., 15.5" hint produced Float values
                      that Prisma rejected, failing the entire course save. */}
                  <Input
                    id="duration"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    placeholder="e.g., 15"
                  />
                </div>
              )}

              {(contentType === 'pdf' || contentType === 'image' || contentType === 'file') && (
                <div>
                  <Label>Upload File</Label>
                  <FileUploadZone
                    type={contentType === 'image' ? 'thumbnail' : 'material'}
                    courseId={courseId}
                    chapterId={chapterId}
                    onUploadComplete={handleFileUpload}
                    label={`Upload ${getContentTypeLabel(contentType)}`}
                    description={contentType === 'file' 
                      ? "Supported: PPT, PPTX, PDF, DOC, DOCX, TXT, ZIP (Max 50MB)"
                      : undefined}
                  />
                  {contentType === 'file' && (
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Tip: For large files, consider uploading to Google Drive and using the &quot;Add Link&quot; option instead
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave}>
                {editingContent ? 'Update' : 'Add'} Content
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Content
            <span className="ml-1.5 font-normal normal-case tracking-normal text-gray-400">
              ({sortedContents.length})
            </span>
          </h4>
          {actionButtons}
        </div>
        {contentListAndDialog}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{chapterName}</CardTitle>
            <CardDescription>
              {sortedContents.length} content item{sortedContents.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          {actionButtons}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {contentListAndDialog}
      </CardContent>
    </Card>
  );
}

