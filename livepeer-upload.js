// livepeer-upload.js — FALASTEEN.INK
// Decentralized video streaming via Livepeer Studio
(function() {
  var API_KEY = window.LIVEPEER_API_KEY || '7f763967-912a-4243-99e9-92505c2bcb9b';

  window.LivepeerUpload = {

    // Upload a File object to Livepeer, returns { assetId, playbackId, playbackUrl }
    upload: async function(file, title, onProgress) {
      try {
        // Step 1: Request upload URL from Livepeer
        var res = await fetch('https://livepeer.studio/api/asset/request-upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: title || file.name })
        });
        if (!res.ok) throw new Error('Livepeer request-upload failed: ' + res.status);
        var data = await res.json();

        var uploadUrl = data.url && data.url.url ? data.url.url : (data.tusEndpoint || null);
        var assetId   = data.asset && data.asset.id;

        if (!uploadUrl) throw new Error('No upload URL returned from Livepeer');

        // Step 2: PUT the file to the signed upload URL
        var xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        if (typeof onProgress === 'function') {
          xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
          };
        }
        await new Promise(function(resolve, reject) {
          xhr.onload  = function() { if (xhr.status < 300) resolve(); else reject(new Error('Upload failed: ' + xhr.status)); };
          xhr.onerror = function() { reject(new Error('Network error during upload')); };
          xhr.send(file);
        });

        // Step 3: Return playback info
        var playbackId  = data.asset && data.asset.playbackId;
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
