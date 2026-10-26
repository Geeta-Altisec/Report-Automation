const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = '178c6fc778ccc68e1d6a'; // GitHub CLI client ID
const REPO_DIR = path.join(__dirname, '..', 'Reports-main');
const TARGET_REPO = 'Geeta-Altisec/Report-Automation';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('Requesting GitHub Device Authorization Code...');
    const initRes = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            scope: 'repo,read:org,workflow'
        })
    });

    const initData = await initRes.json();
    if (!initData.device_code) {
        console.error('Failed to get device code:', initData);
        process.exit(1);
    }

    const { device_code, user_code, verification_uri, interval = 5, expires_in } = initData;

    console.log('\n======================================================');
    console.log('👉 GITHUB AUTHENTICATION REQUIRED TO PUSH:');
    console.log(`1. Visit: ${verification_uri}`);
    console.log(`2. Enter code: ${user_code}`);
    console.log('======================================================\n');
    console.log('Waiting for authorization (press Ctrl+C to cancel)...');

    const startTime = Date.now();
    const pollInterval = (interval + 1) * 1000;

    while (Date.now() - startTime < expires_in * 1000) {
        await sleep(pollInterval);

        const pollRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                device_code: device_code,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            })
        });

        const pollData = await pollRes.json();

        if (pollData.error) {
            if (pollData.error === 'authorization_pending') {
                process.stdout.write('.');
                continue;
            } else if (pollData.error === 'slow_down') {
                await sleep(5000);
                continue;
            } else {
                console.error('\nAuthentication failed:', pollData.error_description || pollData.error);
                process.exit(1);
            }
        }

        if (pollData.access_token) {
            console.log('\n\n✅ GitHub Authorization Successful!');
            const token = pollData.access_token;

            // Verify authenticated user
            const userRes = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'AltiSec-Pusher'
                }
            });
            const userData = await userRes.json();
            console.log(`Logged in as: ${userData.login} (${userData.name || userData.login})`);

            // Verify write permission on target repo
            const repoRes = await fetch(`https://api.github.com/repos/${TARGET_REPO}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'AltiSec-Pusher'
                }
            });
            const repoData = await repoRes.json();
            console.log(`Target Repo: ${repoData.full_name} | Permissions:`, repoData.permissions || 'N/A');

            // Configure remote with token and push
            console.log('\nPushing commits to https://github.com/' + TARGET_REPO + '...');
            const authRemoteUrl = `https://x-access-token:${token}@github.com/${TARGET_REPO}.git`;
            const cleanRemoteUrl = `https://github.com/${TARGET_REPO}.git`;

            try {
                execSync(`git -C "${REPO_DIR}" remote set-url origin "${authRemoteUrl}"`);
                const pushOutput = execSync(`git -C "${REPO_DIR}" push -u origin main --force-with-lease`, { encoding: 'utf8' });
                console.log(pushOutput);
                console.log('✅ PUSH COMPLETED SUCCESSFULLY!');
            } finally {
                // Always reset remote URL back to clean URL so token is never exposed in git config
                execSync(`git -C "${REPO_DIR}" remote set-url origin "${cleanRemoteUrl}"`);
                // Also store token in git-credential-manager
                try {
                    execSync(`git-credential-manager store`, {
                        input: `protocol=https\nhost=github.com\nusername=x-access-token\npassword=${token}\n\n`
                    });
                } catch(e) {}
            }

            console.log('\nRepository is live at: https://github.com/' + TARGET_REPO);
            return;
        }
    }

    console.error('\nCode expired. Please run the command again.');
    process.exit(1);
}

main().catch(console.error);