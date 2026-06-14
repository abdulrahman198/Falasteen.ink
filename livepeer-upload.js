// livepeer-upload.js — FALASTEEN.INK
// Decentralized video streaming via Livepeer Studio.
// The Livepeer API key now lives server-side in the Supabase edge function
// "livepeer-upload"; the browser never sees it. We ask that function for a
// signed upload URL, then PUT the file bytes directly to it.
(function() {

  function functionUrl(name) {
    var base = window.SUPABASE_URL;
    if (!base) throw new Error('SUPABASE_URL is not configured (app-config.js)');
    return base.replace(/\/+$/, '') + '/functions/v1/' + name;
  }

  window.LivepeerUpload = {

    // Upload a File object via the edge function.
    // Returns { assetId, playbackId, playbackUrl }
    upload: async function(file, title, onProgress) {
      try {
        // Step 1: ask our edge function (which holds the Livepeer key) for an
        // upload URL.
        var res = await fetch(functionUrl('livepeer-upload'), {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + (window.SUPABASE_ANON_KEY || ''),
            'apikey': window.SUPABASE_ANON_KEY || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: title || file.name })
        });
        if (!res.ok) throw new Error('Upload request failed: ' + res.status);
        var data = await res.json();

        var uploadUrl = data.uploadUrl || data.tusEndpoint || null;
        var assetId = data.asset && data.asset.id;
        var playbackId = data.asset && data.asset.playbackId;

        if (!uploadUrl) throw new Error('No upload URL returned from server');

        // Step 2: PUT the file straight to the signed upload URL (no key needed).
        var xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        if (typeof onProgress === 'function') {
          xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
          };
        }
        await new Promise(function(resolve, reject) {
          xhr.onload = function() { if (xhr.status < 300) resolve(); else reject(new Error('Upload failed: ' + xhr.status)); };
          xhr.onerror = function() { reject(new Error('Network error during upload')); };
          xhr.send(file);
        });

        // Step 3: Return playback info
        var playbackUrl = playbackId
          ? 'https://livepeercdn.studio/hls/' + playbackId + '/index.m3u8'
          : null;

        return { assetId: assetId, playbackId: playbackId, playbackUrl: playbackUrl };
      } catch (e) {
        console.error('[LivepeerUpload] error:', e);
        throw e;
      }
    },

    // Return the HLS streaming URL for an already-uploaded asset
    getPlaybackUrl: function(playbackId) {
      return 'https://livepeercdn.studio/hls/' + playbackId + '/index.m3u8';
    }
  };
})();
