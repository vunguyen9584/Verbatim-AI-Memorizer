KEY_FILE="/home/vunvn/.ssh/khocongcu.io.vn"
rsync -e "ssh -i ${KEY_FILE}" -avz --delete ./dist vunvn1@160.25.232.163:/home/vunvn1/hocthuoc/
ssh -i ${KEY_FILE} vunvn1@160.25.232.163 "cd /home/vunvn1/hocthuoc; docker compose down; docker compose up -d --build"
