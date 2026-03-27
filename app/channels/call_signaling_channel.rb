# frozen_string_literal: true

class CallSignalingChannel < RoomChannel
  def subscribed
    if @room = find_room
      unless @room.direct?
        reject
        return
      end
      stream_for @room
    else
      reject
    end
  end

  def relay(data)
    return unless @room&.direct?

    payload = permit_signal(data).to_h.stringify_keys.slice(
      "type", "call_id", "sdp", "video", "candidate", "sdpMid", "sdpMLineIndex"
    )
    CallSignalingChannel.broadcast_to @room, payload.merge("from_user_id" => current_user.id)
  end

  private
    def permit_signal(data)
      if data.is_a?(ActionController::Parameters)
        data.permit(:type, :call_id, :sdp, :video, :candidate, :sdpMid, :sdpMLineIndex)
      else
        ActionController::Parameters.new(data).permit(:type, :call_id, :sdp, :video, :candidate, :sdpMid, :sdpMLineIndex)
      end
    end
end
