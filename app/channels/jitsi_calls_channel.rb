class JitsiCallsChannel < RoomChannel
  def subscribed
    if Campfire::Rtc.jitsi_enabled?
      super
    else
      reject
    end
  end

  def invite(data)
    # Membership may have been revoked since the socket subscribed.
    return unless Campfire::Rtc.jitsi_enabled? && find_room
    return unless %w[ audio video ].include?(data["media"])

    JitsiCallsChannel.broadcast_to @room, {
      type: "invite", media: data["media"], from_user_id: current_user.id
    }
  end
end
