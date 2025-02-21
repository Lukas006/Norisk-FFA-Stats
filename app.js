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

    if (!input) {
        showError('Bitte gib einen Username oder eine UUID ein');
        return;
    }

    try {
        // Show loading state
        statsContainer.classList.remove('hidden');
        
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

        // Debug logging
        console.log('Fetched player data:', data);

        // Update basic stats
        document.getElementById('kills').textContent = data.kills || 0;
        document.getElementById('deaths').textContent = data.deaths || 0;
        document.getElementById('kd').textContent = calculateKD(data.kills || 0, data.deaths || 0);
        document.getElementById('wins').textContent = data.wins || 0;
        document.getElementById('gamesPlayed').textContent = data.gamesPlayed || 0;
        document.getElementById('winRate').textContent = calculateWinRate(data.wins || 0, data.gamesPlayed || 0) + '%';

        // Update skin viewer
        await updateSkinViewer(input);

    } catch (error) {
        console.error('Error fetching stats:', error);
        showError(error.message);
        statsContainer.classList.add('hidden');
    }
}

// Toggle Advanced Stats
function toggleAdvancedStats() {
    const advancedStats = document.getElementById('advancedStats');
    const buttonText = document.getElementById('advancedStatsButtonText');
    const icon = document.getElementById('advancedStatsIcon');
    
    if (advancedStats.classList.contains('hidden')) {
        advancedStats.classList.remove('hidden');
        buttonText.textContent = 'Hide Advanced Stats';
        icon.classList.add('rotate-180');
    } else {
        advancedStats.classList.add('hidden');
        buttonText.textContent = 'Show Advanced Stats';
        icon.classList.remove('rotate-180');
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
    const leaderboardContent = document.getElementById('leaderboardContent');
    const leaderboardTitle = document.getElementById('leaderboardTitle');

    try {
        // Log the current type being requested
        console.log(`Attempting to load leaderboard for type: ${type}`);

        // Fetch leaderboard data
        const response = await fetch(`https://api.hglabor.de/stats/ffa/top?sort=${type}&page=1`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        // Log response details
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        // Check if response is ok
        if (!response.ok) {
            // Try to get error text
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            throw new Error(`Fehler beim Laden des Leaderboards: Status ${response.status}, ${errorText}`);
        }

        // Attempt to parse JSON
        let data;
        try {
            data = await response.json();
            console.log('Received leaderboard data:', data);
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            throw new Error('Fehler beim Parsen der Leaderboard-Daten');
        }

        // Validate data
        if (!Array.isArray(data)) {
            console.error('Invalid data format:', typeof data, data);
            throw new Error('Ungültiges Datenformat vom Server');
        }

        // Log detailed K/D ratio information if sorting by K/D
        if (type === 'kd') {
            console.group('K/D Ratio Debugging');
            const kdDetails = data.map((player, index) => ({
                username: player.playerId,
                kills: player.kills || 0,
                deaths: player.deaths || 0,
                kdRatio: ((player.kills || 0) / Math.max(player.deaths || 1, 1)).toFixed(2)
            }));
            console.table(kdDetails);
            console.log('Raw K/D Data:', kdDetails);
            console.groupEnd();
        }

        // Set the current leaderboard type
        currentLeaderboard = type;

        // Modify title based on selected category
        const titles = {
            kills: '🎯 Top Kills',
            deaths: '💀 Top Deaths',
            wins: '🏆 Top Wins',
            kd: '⚔️ Top K/D Ratio'
        };
        leaderboardTitle.textContent = titles[type];
        
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
                        username: nameData.success ? nameData.data.player.username : 'Unbekannt',
                        uuid: formattedUUID
                    };
                } catch (error) {
                    console.warn(`Error fetching name for player ${uuid}:`, error);
                    return {
                        ...player,
                        username: 'Unbekannt',
                        uuid: formattedUUID
                    };
                }
            })
        );
        
        // Generate leaderboard HTML
        const leaderboardHTML = sortedData.map((player, index) => {
            let value, displayValue;
            if (type === 'kd') {
                // Calculate K/D ratio
                const kills = player.kills || 0;
                const deaths = Math.max(player.deaths || 1, 1);
                value = kills / deaths;
                displayValue = value.toFixed(2);
                
                // Additional logging for K/D calculation
                console.log(`Player ${player.username}: Kills=${kills}, Deaths=${deaths}, K/D=${displayValue}`);
            } else {
                value = player[type] || 0;
                displayValue = parseInt(value).toLocaleString();
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
            
            return `
                <div class="leaderboard-row p-4 flex items-center justify-between" style="animation: fadeIn 0.5s ease-in-out ${index * 0.1}s both;">
                    <div class="flex items-center gap-4">
                        <span class="text-lg font-bold ${rankStyle}">
                            ${index < 3 ? rankEmojis[index] : '#' + (index + 1)}
                        </span>
                        <img 
                            src="https://mc-heads.net/avatar/${player.uuid}/32" 
                            alt="${player.username}'s avatar" 
                            class="w-8 h-8 rounded-full border-2 border-slate-600"
                        >
                        <span 
                            class="font-semibold text-slate-200 cursor-pointer hover:text-blue-400 transition-colors"
                            onclick="showPlayerPreview(${JSON.stringify(player).replace(/"/g, '&quot;')}, event)"
                        >
                            ${player.username}
                        </span>
                    </div>
                    <span class="font-bold ${getValueColor(type)} text-lg">${displayValue}</span>
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
        console.error('Detailed Leaderboard Error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        leaderboardContent.innerHTML = `
            <div class="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <span class="text-red-500">⚠️ Fehler beim Laden des Leaderboards: ${error.message}</span>
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
    return (kills / Math.max(deaths, 1)).toFixed(2);
}

function calculateWinRate(wins, games) {
    return ((wins / Math.max(games, 1)) * 100).toFixed(1);
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
}

// Function to create and show player preview
function showPlayerPreview(player, event) {
    // Remove any existing previews
    const existingPreview = document.getElementById('leaderboard-player-preview');
    if (existingPreview) {
        existingPreview.remove();
    }

    // Create preview container
    const preview = document.createElement('div');
    preview.id = 'leaderboard-player-preview';
    preview.className = `
        fixed z-50 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 
        transition-all duration-300 ease-in-out transform 
        opacity-0 scale-90 pointer-events-none
    `;

    // Position the preview near the clicked element
    const rect = event.target.getBoundingClientRect();
    preview.style.top = `${rect.bottom + window.scrollY + 10}px`;
    preview.style.left = `${rect.left + window.scrollX}px`;

    // Prepare preview content
    preview.innerHTML = `
        <div class="p-6 flex items-center space-x-4">
            <img 
                src="https://mc-heads.net/avatar/${player.uuid}/64" 
                alt="${player.username}'s avatar" 
                class="w-16 h-16 rounded-full border-4 border-slate-600"
            >
            <div>
                <h3 class="text-xl font-bold text-white">${player.username}</h3>
                <div class="mt-2 space-y-1 text-slate-300">
                    <p>Kills: ${player.kills || 0}</p>
                    <p>Deaths: ${player.deaths || 0}</p>
                    <p>K/D Ratio: ${((player.kills || 0) / Math.max(player.deaths || 1, 1)).toFixed(2)}</p>
                    <p>Wins: ${player.wins || 0}</p>
                </div>
            </div>
        </div>
    `;

    // Add to document
    document.body.appendChild(preview);

    // Trigger reflow to enable transition
    preview.offsetWidth;

    // Show preview
    preview.classList.remove('opacity-0', 'scale-90', 'pointer-events-none');
    preview.classList.add('opacity-100', 'scale-100');

    // Add click outside listener to close preview
    function closePreview(e) {
        if (!preview.contains(e.target) && e.target !== event.target) {
            preview.classList.add('opacity-0', 'scale-90', 'pointer-events-none');
            preview.classList.remove('opacity-100', 'scale-100');
            
            // Remove the preview after animation
            setTimeout(() => {
                preview.remove();
                document.removeEventListener('click', closePreview);
            }, 300);
        }
    }

    // Add listener after a short delay to prevent immediate closure
    setTimeout(() => {
        document.addEventListener('click', closePreview);
    }, 50);
}

// Load initial leaderboard
loadLeaderboard();
