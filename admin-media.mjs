import { getStore } from '@netlify/blobs';

const STORE_NAME = 'akyra-admin-media';
const BLOB_KEY = 'site-state';
const ASSET_PREFIX = 'assets/';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

export default async (request) => {
  const store = getStore(STORE_NAME);

  try {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.searchParams.has('asset')) {
      const assetKey = url.searchParams.get('asset');
      if (!assetKey || !assetKey.startsWith(ASSET_PREFIX)) {
        return jsonResponse({ error: 'Imagen inválida.' }, 400);
      }

      const asset = await store.getWithMetadata(assetKey, { type: 'blob' });
      if (!asset?.data) {
        return new Response('Imagen no encontrada.', { status: 404 });
      }

      return new Response(asset.data, {
        headers: {
          'content-type': asset.metadata?.contentType || 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable'
        }
      });
    }

    if (request.method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File) || !file.type.startsWith('image/')) {
        return jsonResponse({ error: 'Debes enviar un archivo de imagen.' }, 400);
      }

      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const assetKey = `${ASSET_PREFIX}${crypto.randomUUID()}.${extension}`;
      await store.set(assetKey, file, {
        metadata: { contentType: file.type }
      });

      return jsonResponse({
        url: `${url.origin}/api/admin-media?asset=${encodeURIComponent(assetKey)}`
      }, 201);
    }

    if (request.method === 'GET') {
      const state = await store.get(BLOB_KEY, { type: 'json' });
      return jsonResponse(state || { products: [], media: {} });
    }

    if (request.method === 'PUT') {
      const state = await request.json();
      if (!state || typeof state !== 'object') {
        return jsonResponse({ error: 'Estado inválido.' }, 400);
      }

      await store.setJSON(BLOB_KEY, {
        products: Array.isArray(state.products) ? state.products : [],
        media: state.media && typeof state.media === 'object' ? state.media : {}
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'Método no permitido.' }, 405);
  } catch (error) {
    console.error('No se pudo acceder al almacenamiento de Netlify.', error);
    return jsonResponse({ error: 'No se pudo acceder al almacenamiento de Netlify.' }, 500);
  }
};
