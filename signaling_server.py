import asyncio
import json
import websockets

# rooms structure:
# {
#   "room_id": {
#     "pin": "...",
#     "users": { ws: {"username": "...", "is_host": bool, "is_moderator": bool, "can_share": bool} },
#     "pending": { ws: {"username": "..."} },  # waiting room
#     "polls": []  # active polls
#   }
# }
rooms = {}

async def broadcast(room_id, message, exclude_ws=None):
    if room_id in rooms:
        for ws in list(rooms[room_id]["users"].keys()):
            if ws != exclude_ws:
                try:
                    await ws.send(json.dumps(message))
                except websockets.exceptions.ConnectionClosed:
                    pass

def find_user_ws(room_id, username):
    if room_id not in rooms:
        return None
    for ws_conn, info in rooms[room_id]["users"].items():
        if info["username"] == username:
            return ws_conn
    return None

def is_privileged(room_id, websocket):
    if room_id not in rooms or websocket not in rooms[room_id]["users"]:
        return False
    info = rooms[room_id]["users"][websocket]
    return info.get("is_host") or info.get("is_moderator")

def get_host_ws(room_id):
    if room_id not in rooms:
        return None
    for ws_conn, info in rooms[room_id]["users"].items():
        if info.get("is_host"):
            return ws_conn
    return None

async def handle_client(websocket):
    current_room = None
    is_pending = False
    try:
        async for message in websocket:
            data = json.loads(message)
            action = data.get("action")
            
            # ==================== JOIN ====================
            if action == "join":
                room_id = data.get("room_id")
                username = data.get("username")
                is_host = data.get("is_host", False)
                pin = data.get("pin", "")
                
                if room_id not in rooms:
                    rooms[room_id] = {"pin": pin, "users": {}, "pending": {}, "polls": []}
                
                if rooms[room_id]["pin"] and rooms[room_id]["pin"] != pin:
                    await websocket.send(json.dumps({"action": "error", "message": "Falscher Raum-PIN!"}))
                    return
                
                current_room = room_id
                
                # Host joins directly, guests go to waiting room
                if is_host or not rooms[room_id]["users"]:
                    # First person or host: join directly
                    rooms[room_id]["users"][websocket] = {
                        "username": username, "is_host": is_host,
                        "is_moderator": False, "can_share": is_host
                    }
                    print(f"User {username} joined room {room_id} as {'Host' if is_host else 'Guest'}")
                    
                    await broadcast(room_id, {
                        "action": "user-joined", "username": username, "is_host": is_host
                    }, exclude_ws=websocket)
                    
                    existing_users = []
                    for ws, info in rooms[room_id]["users"].items():
                        if ws != websocket:
                            existing_users.append({
                                "username": info["username"],
                                "is_host": info["is_host"],
                                "is_moderator": info["is_moderator"]
                            })
                    
                    await websocket.send(json.dumps({"action": "room-info", "users": existing_users}))
                else:
                    # Guest: put in waiting room
                    rooms[room_id]["pending"][websocket] = {"username": username}
                    is_pending = True
                    await websocket.send(json.dumps({"action": "waiting-room"}))
                    
                    # Notify host + moderators
                    for ws_conn, info in rooms[room_id]["users"].items():
                        if info.get("is_host") or info.get("is_moderator"):
                            try:
                                await ws_conn.send(json.dumps({
                                    "action": "pending-user", "username": username
                                }))
                            except:
                                pass
                    print(f"User {username} waiting in lobby for room {room_id}")

            # ==================== ADMIT / REJECT from waiting room ====================
            elif action == "admit-user":
                target = data.get("target")
                if is_privileged(current_room, websocket):
                    target_ws = None
                    for ws_conn, info in rooms[current_room]["pending"].items():
                        if info["username"] == target:
                            target_ws = ws_conn
                            break
                    if target_ws:
                        username = rooms[current_room]["pending"][target_ws]["username"]
                        del rooms[current_room]["pending"][target_ws]
                        
                        rooms[current_room]["users"][target_ws] = {
                            "username": username, "is_host": False,
                            "is_moderator": False, "can_share": False
                        }
                        
                        # Tell the admitted user
                        existing_users = []
                        for ws, info in rooms[current_room]["users"].items():
                            if ws != target_ws:
                                existing_users.append({
                                    "username": info["username"],
                                    "is_host": info["is_host"],
                                    "is_moderator": info["is_moderator"]
                                })
                        try:
                            await target_ws.send(json.dumps({"action": "admitted", "users": existing_users}))
                        except:
                            pass
                        
                        # Tell everyone else
                        await broadcast(current_room, {
                            "action": "user-joined", "username": username, "is_host": False
                        }, exclude_ws=target_ws)
                        
                        print(f"User {username} admitted to room {current_room}")

            elif action == "reject-user":
                target = data.get("target")
                if is_privileged(current_room, websocket):
                    for ws_conn, info in list(rooms[current_room]["pending"].items()):
                        if info["username"] == target:
                            try:
                                await ws_conn.send(json.dumps({"action": "rejected"}))
                            except:
                                pass
                            del rooms[current_room]["pending"][ws_conn]
                            break

            # ==================== SIGNALING ====================
            elif action in ("offer", "answer", "ice-candidate", "recording-start", "recording-stop"):
                await broadcast(current_room, data, exclude_ws=websocket)
                
            # ==================== CHAT ====================
            elif action == "chat":
                if current_room and websocket in rooms[current_room]["users"]:
                    await broadcast(current_room, {
                        "action": "chat",
                        "username": rooms[current_room]["users"][websocket]["username"],
                        "message": data.get("message")
                    })
                
            # ==================== MODERATION ====================
            elif action == "kick":
                target = data.get("target")
                if is_privileged(current_room, websocket):
                    target_ws = find_user_ws(current_room, target)
                    if target_ws and not rooms[current_room]["users"][target_ws].get("is_host"):
                        try:
                            await target_ws.send(json.dumps({"action": "kicked"}))
                        except:
                            pass

            elif action == "unmute":
                target = data.get("target")
                if is_privileged(current_room, websocket):
                    target_ws = find_user_ws(current_room, target)
                    if target_ws:
                        try:
                            await target_ws.send(json.dumps({"action": "unmute-request"}))
                        except:
                            pass

            elif action == "promote-moderator":
                target = data.get("target")
                if current_room and rooms[current_room]["users"][websocket].get("is_host"):
                    target_ws = find_user_ws(current_room, target)
                    if target_ws:
                        rooms[current_room]["users"][target_ws]["is_moderator"] = True
                        rooms[current_room]["users"][target_ws]["can_share"] = True
                        try:
                            await target_ws.send(json.dumps({"action": "promoted-moderator"}))
                        except:
                            pass
                        await broadcast(current_room, {
                            "action": "role-changed", "username": target, "role": "moderator"
                        })

            elif action == "grant-screen-share":
                target = data.get("target")
                if is_privileged(current_room, websocket):
                    target_ws = find_user_ws(current_room, target)
                    if target_ws:
                        rooms[current_room]["users"][target_ws]["can_share"] = True
                        try:
                            await target_ws.send(json.dumps({"action": "screen-share-granted"}))
                        except:
                            pass

            elif action == "revoke-screen-share":
                target = data.get("target")
                if is_privileged(current_room, websocket):
                    target_ws = find_user_ws(current_room, target)
                    if target_ws:
                        rooms[current_room]["users"][target_ws]["can_share"] = False
                        try:
                            await target_ws.send(json.dumps({"action": "screen-share-revoked"}))
                        except:
                            pass

            # ==================== HAND RAISE ====================
            elif action == "hand-raise":
                if current_room and websocket in rooms[current_room]["users"]:
                    username = rooms[current_room]["users"][websocket]["username"]
                    await broadcast(current_room, {
                        "action": "hand-raised", "username": username
                    }, exclude_ws=websocket)

            elif action == "hand-lower":
                if current_room and websocket in rooms[current_room]["users"]:
                    username = rooms[current_room]["users"][websocket]["username"]
                    await broadcast(current_room, {
                        "action": "hand-lowered", "username": username
                    }, exclude_ws=websocket)

            # ==================== REACTIONS ====================
            elif action == "reaction":
                if current_room and websocket in rooms[current_room]["users"]:
                    username = rooms[current_room]["users"][websocket]["username"]
                    await broadcast(current_room, {
                        "action": "reaction",
                        "username": username,
                        "emoji": data.get("emoji", "👏")
                    })

            # ==================== POLLS ====================
            elif action == "create-poll":
                if is_privileged(current_room, websocket):
                    poll = {
                        "id": len(rooms[current_room]["polls"]),
                        "question": data.get("question"),
                        "options": data.get("options", []),
                        "votes": {},  # { username: option_index }
                        "active": True
                    }
                    rooms[current_room]["polls"].append(poll)
                    await broadcast(current_room, {
                        "action": "new-poll",
                        "poll_id": poll["id"],
                        "question": poll["question"],
                        "options": poll["options"]
                    })

            elif action == "vote-poll":
                if current_room and websocket in rooms[current_room]["users"]:
                    poll_id = data.get("poll_id")
                    option = data.get("option")
                    username = rooms[current_room]["users"][websocket]["username"]
                    if poll_id < len(rooms[current_room]["polls"]):
                        poll = rooms[current_room]["polls"][poll_id]
                        if poll["active"]:
                            poll["votes"][username] = option
                            # Broadcast updated results
                            results = [0] * len(poll["options"])
                            for v in poll["votes"].values():
                                if v < len(results):
                                    results[v] += 1
                            await broadcast(current_room, {
                                "action": "poll-update",
                                "poll_id": poll_id,
                                "results": results,
                                "total": len(poll["votes"])
                            })

            elif action == "close-poll":
                if is_privileged(current_room, websocket):
                    poll_id = data.get("poll_id")
                    if poll_id < len(rooms[current_room]["polls"]):
                        rooms[current_room]["polls"][poll_id]["active"] = False
                        await broadcast(current_room, {
                            "action": "poll-closed", "poll_id": poll_id
                        })
                        
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if current_room and current_room in rooms:
            # Remove from pending
            if websocket in rooms[current_room].get("pending", {}):
                del rooms[current_room]["pending"][websocket]
            
            # Remove from users
            if websocket in rooms[current_room]["users"]:
                username = rooms[current_room]["users"][websocket]["username"]
                del rooms[current_room]["users"][websocket]
                print(f"User {username} left room {current_room}")
                
                if not rooms[current_room]["users"] and not rooms[current_room].get("pending"):
                    del rooms[current_room]
                else:
                    await broadcast(current_room, {
                        "action": "user-left", "username": username
                    })

async def main():
    print("Starting TeleMeet Signaling Server on ws://0.0.0.0:8002")
    async with websockets.serve(handle_client, "0.0.0.0", 8002):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
