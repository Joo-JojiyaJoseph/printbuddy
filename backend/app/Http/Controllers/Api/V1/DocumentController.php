<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UploadDocumentRequest;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Models\QrSession;
use App\Services\Documents\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function __construct(private readonly DocumentService $documents) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $docs = $this->session($request)->documents()->orderBy('created_at')->get();

        return DocumentResource::collection($docs);
    }

    public function store(UploadDocumentRequest $request): JsonResponse
    {
        $doc = $this->documents->store($this->session($request), $request->file('file'));

        return (new DocumentResource($doc))->response()->setStatusCode(201);
    }

    public function show(Request $request, string $id): DocumentResource
    {
        return new DocumentResource($this->find($request, $id));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->documents->delete($this->find($request, $id));

        return response()->json(null, 204);
    }

    public function retry(Request $request, string $id): DocumentResource
    {
        return new DocumentResource($this->documents->retry($this->find($request, $id)));
    }

    /**
     * GET /documents/{document}/preview?s=...&expires=...&signature=...
     * Signed, time-limited, bound to the document's session. Streams from the private disk.
     */
    public function preview(Request $request, string $document): StreamedResponse
    {
        $doc = Document::query()->whereKey($document)->whereNull('deleted_at')->where('status', Document::READY)->first();
        abort_if($doc === null || $doc->qr_session_id !== $request->query('s'), 404, 'Not found.');
        abort_unless(QrSession::query()->whereKey($doc->qr_session_id)->usable()->exists(), 410, 'This session has expired.');

        $disk = $this->documents->disk();
        $path = $doc->preview_path ?: $doc->storage_path;
        abort_unless($disk->exists($path), 404, 'Not found.');

        $filename = $doc->isImage() ? $doc->original_name : pathinfo($doc->original_name, PATHINFO_FILENAME).'.pdf';

        return $disk->response($path, $filename, [
            'Content-Type' => $doc->previewMime(),
            'Content-Disposition' => 'inline; filename="'.addslashes(preg_replace('/[^\w .\-]/', '_', $filename)).'"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function session(Request $request): QrSession
    {
        return $request->attributes->get('qr_session');
    }

    /** Documents are only ever resolved THROUGH the current session (no cross-session lookups). */
    private function find(Request $request, string $id): Document
    {
        return $this->session($request)->documents()->whereKey($id)->firstOr(fn () => abort(404, 'Document not found in this session.'));
    }
}
