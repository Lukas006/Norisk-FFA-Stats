let skinViewer = null;
let currentLeaderboard = 'kills';

// Server status check
async function checkServerStatus() {
    try {
        const response = await fetch('https://api.mcstatus.io/v2/status/java/hglabor.de');
        const data = await response.json();
        
        const statusDot = document.getElementById('serverStatus');
        const playerCount = document.getElementById('playerCount');
        
        if (data.online) {
            statusDot.classList.remove('bg-gray-500', 'bg-red-500');
            statusDot.classList.add('bg-green-500');
            playerCount.textContent = `${data.players.online} Spieler Online`;
        } else {
            statusDot.classList.remove('bg-gray-500', 'bg-green-500');
            statusDot.classList.add('bg-red-500');
            playerCount.textContent = 'Server Offline';
        }
    } catch (error) {
        console.error('Error checking server status:', error);
        const statusDot = document.getElementById('serverStatus');
        const playerCount = document.getElementById('playerCount');
        statusDot.classList.remove('bg-gray-500', 'bg-green-500');
        statusDot.classList.add('bg-red-500');
        playerCount.textContent = 'Status nicht verfügbar';
    }
}

// Copy IP function
function copyIP() {
    navigator.clipboard.writeText('hglabor.de');
    const ipText = document.getElementById('ipText');
    const originalText = ipText.textContent;
    ipText.textContent = 'IP Kopiert!';
    setTimeout(() => {
        ipText.textContent = originalText;
    }, 2000);
}

// Check server status every 30 seconds
checkServerStatus();
setInterval(checkServerStatus, 30000);

async function fetchStats() {
    const input = document.getElementById('uuidInput').value.trim();
    const statsContainer = document.getElementById('statsContainer');
    const playerInfo = document.getElementById('playerInfo');
    const errorMessage = document.getElementById('errorMessage');

    if (!input) {
        showError('Bitte gib einen Username oder eine UUID ein');
        return;
    }

    try {
        // First, determine if input is UUID or username
        let uuid = input;
        if (!isUUID(input)) {
            // If not UUID, try to fetch UUID from username
            uuid = await fetchUUID(input);
        } else {
            // Ensure UUID has hyphens
            uuid = formatUUID(input);
        }

        // Fetch player stats
        const response = await fetch(`https://api.hglabor.de/stats/ffa/${uuid}`);
        
        if (!response.ok) {
            throw new Error('Spieler nicht gefunden');
        }

        const data = await response.json();
        
        // Update stats
        document.getElementById('kills').textContent = data.kills;
        document.getElementById('deaths').textContent = data.deaths;
        document.getElementById('kd').textContent = calculateKD(data.kills, data.deaths);
        document.getElementById('wins').textContent = data.wins;
        document.getElementById('gamesPlayed').textContent = data.gamesPlayed;
        document.getElementById('winRate').textContent = calculateWinRate(data.wins, data.gamesPlayed) + '%';

        // Fetch player name and update skin viewer
        await updatePlayerInfo(uuid);

        // Show containers and hide error
        if (playerInfo) playerInfo.classList.remove('hidden');
        if (errorMessage) errorMessage.classList.add('hidden');
        if (statsContainer) statsContainer.classList.remove('hidden');
    } catch (error) {
        showError(error.message);
        if (playerInfo) playerInfo.classList.add('hidden');
        if (statsContainer) statsContainer.classList.add('hidden');
    }
}

async function fetchUUID(username) {
    try {
        const response = await fetch(`https://playerdb.co/api/player/minecraft/${username}`);
        
        if (!response.ok) {
            throw new Error('Spieler nicht gefunden');
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(`Konnte UUID für "${username}" nicht finden`);
        }
        
        // Return UUID with hyphens
        return data.data.player.id;
    } catch (error) {
        throw new Error(`Konnte UUID für "${username}" nicht finden`);
    }
}

function isUUID(str) {
    // UUID format: 8-4-4-4-12 or 32 characters without hyphens
    const uuidPattern = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
    return uuidPattern.test(str);
}

async function loadLeaderboard(type = 'kills') {
    currentLeaderboard = type;
    const leaderboardContent = document.getElementById('leaderboardContent');
    const leaderboardTitle = document.getElementById('leaderboardTitle');
    
    try {
        // Show loading state with animation
        leaderboardContent.innerHTML = `
            <div class="text-center text-slate-400 animate-pulse">
                <div class="inline-block w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                Lade Leaderboard...
            </div>`;
        
        // Fetch leaderboard data from the top players endpoint
        const response = await fetch(`https://api.hglabor.de/stats/FFA/top?sort=${type}&page=1`);
        if (!response.ok) {
            throw new Error('Fehler beim Laden des Leaderboards');
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error('Ungültiges Datenformat vom Server');
        }
        
        // Take top 10 and fetch their names
        const sortedData = await Promise.all(
            data.slice(0, 10).map(async (player) => {
                try {
                    const uuid = player.playerId;
                    const formattedUUID = formatUUID(uuid);
                    const nameResponse = await fetch(`https://playerdb.co/api/player/minecraft/${formattedUUID}`);
                    const nameData = await nameResponse.json();
                    
                    return {
                        ...player,
                        username: nameData.success ? nameData.data.player.username : 'Unbekannt'
                    };
                } catch (error) {
                    return {
                        ...player,
                        username: 'Unbekannt'
                    };
                }
            })
        );
        
        // Update title with animation
        const titles = {
            kills: '🎯 Top Kills',
            deaths: '💀 Top Deaths',
            wins: '🏆 Top Wins',
            kd: '⚔️ Top K/D Ratio'
        };
        leaderboardTitle.textContent = titles[type];
        
        // Generate leaderboard HTML
        const leaderboardHTML = sortedData.map((player, index) => {
            let value;
            if (type === 'kd') {
                value = calculateKD(player.kills || 0, player.deaths || 0);
            } else {
                value = player[type] || 0;
            }
            
            const rankColors = [
                'from-yellow-500 to-orange-500', // 1st place
                'from-slate-300 to-slate-400',   // 2nd place
                'from-amber-600 to-amber-700'    // 3rd place
            ];
            
            const rankEmojis = ['👑', '🥈', '🥉'];
            const rankColor = index < 3 ? rankColors[index] : '';
            const rankStyle = index < 3 
                ? `bg-gradient-to-r ${rankColor} text-transparent bg-clip-text` 
                : 'text-slate-400';
            
            // Format the value based on type
            let formattedValue;
            if (type === 'kd') {
                formattedValue = parseFloat(value).toFixed(2);
            } else {
                formattedValue = parseInt(value).toLocaleString();
            }
            
            return `
                <div class="leaderboard-row p-4 flex items-center justify-between" style="animation: fadeIn 0.5s ease-in-out ${index * 0.1}s both;">
                    <div class="flex items-center gap-4">
                        <span class="text-lg font-bold ${rankStyle}">
                            ${index < 3 ? rankEmojis[index] : '#' + (index + 1)}
                        </span>
                        <span class="font-semibold text-slate-200">${player.username}</span>
                    </div>
                    <span class="font-bold ${getValueColor(type)} text-lg">${formattedValue}</span>
                </div>
            `;
        }).join('');
        
        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
        
        leaderboardContent.innerHTML = leaderboardHTML || '<div class="text-center text-slate-400">Keine Daten verfügbar</div>';
    } catch (error) {
        console.error('Leaderboard error:', error);
        leaderboardContent.innerHTML = `
            <div class="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <span class="text-red-500">⚠️ Fehler beim Laden des Leaderboards</span>
            </div>`;
    }
}

function formatUUID(uuid) {
    // If UUID doesn't have hyphens, add them
    if (!uuid.includes('-')) {
        return uuid.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    }
    return uuid;
}

function getValueColor(type) {
    switch(type) {
        case 'kills': return 'text-green-500';
        case 'deaths': return 'text-red-500';
        case 'wins': return 'text-yellow-500';
        case 'kd': return 'text-blue-500';
        default: return 'text-white';
    }
}

async function updatePlayerInfo(uuid) {
    try {
        // Use a CORS proxy to fetch player name from Mojang API
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const mojangUrl = `https://api.mojang.com/user/profile/${uuid}`;
        const response = await fetch(proxyUrl + encodeURIComponent(mojangUrl));
        
        if (!response.ok) {
            throw new Error('Spieler nicht gefunden');
        }
        
        const data = await response.json();
        const playerName = document.getElementById('playerName');
        const playerUUID = document.getElementById('playerUUID');
        
        // Update player name and UUID if elements exist
        if (playerName) playerName.textContent = data.name;
        if (playerUUID) playerUUID.textContent = shortenUUID(uuid);
        
        // Update or create skin viewer
        await updateSkinViewer(data.name);
    } catch (error) {
        console.error('Error fetching player info:', error);
        const playerName = document.getElementById('playerName');
        const playerUUID = document.getElementById('playerUUID');
        if (playerName) playerName.textContent = 'Unbekannter Spieler';
        if (playerUUID) playerUUID.textContent = shortenUUID(uuid);
    }
}

async function updateSkinViewer(username) {
    try {
        // Initialize skinviewer if it doesn't exist
        if (!skinViewer) {
            skinViewer = new skinview3d.SkinViewer({
                canvas: document.getElementById("skinViewer"),
                width: 300,
                height: 400,
                skin: `https://mc-heads.net/skin/${username}`
            });

            // Set up animation
            skinViewer.animation = new skinview3d.CompositeAnimation();
            
            // Add walking animation with slower speed
            const walkingAnimation = new skinview3d.WalkingAnimation();
            walkingAnimation.speed = 0.7; // Slower, more natural walking speed
            skinViewer.animation.add(walkingAnimation);
            
            // Add rotating animation with custom settings
            skinViewer.animation.add(new skinview3d.RotatingAnimation({
                speed: 0.5,
                yawOffset: 0.5,
                pitchOffset: 0.1
            }));

            // Camera position and angle
            skinViewer.camera.position.set(15, 2, 35);
            skinViewer.camera.lookAt(0, 0, 0);

            // Add controls for user interaction
            skinViewer.controls.enableRotation = true;
            skinViewer.controls.enableZoom = true;
            skinViewer.controls.enablePan = true;
            
            // Adjust fov for better view
            skinViewer.fov = 70;
        } else {
            // Just update the skin if viewer already exists
            await skinViewer.loadSkin(`https://mc-heads.net/skin/${username}`);
        }
    } catch (error) {
        console.error('Error updating skin viewer:', error);
    }
}

function shortenUUID(uuid) {
    // Remove hyphens and take first 8 characters
    return uuid.replace(/-/g, '').substring(0, 8) + '...';
}

function calculateKD(kills, deaths) {
    if (deaths === 0) return kills.toFixed(2);
    return (kills / deaths).toFixed(2);
}

function calculateWinRate(wins, gamesPlayed) {
    if (gamesPlayed === 0) return '0.00';
    return ((wins / gamesPlayed) * 100).toFixed(2);
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
}

// Load initial leaderboard
loadLeaderboard();
