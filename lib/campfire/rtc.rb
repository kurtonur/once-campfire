# frozen_string_literal: true

module Campfire
  module Rtc
    module_function

    def ice_servers
      if ENV["CAMPFIRE_ICE_SERVERS_JSON"].present?
        JSON.parse(ENV.fetch("CAMPFIRE_ICE_SERVERS_JSON"))
      else
        [ stun_entry ] + optional_turn
      end
    end

    def stun_entry
      url = ENV.fetch("CAMPFIRE_STUN_URL", "stun:stun.l.google.com:19302")
      { "urls" => url }
    end

    def optional_turn
      return [] if ENV["CAMPFIRE_TURN_URL"].blank?

      [
        {
          "urls" => ENV.fetch("CAMPFIRE_TURN_URL"),
          "username" => ENV["CAMPFIRE_TURN_USERNAME"],
          "credential" => ENV["CAMPFIRE_TURN_CREDENTIAL"]
        }.compact
      ]
    end

    def jitsi_base_url
      value = ENV["CAMPFIRE_JITSI_BASE_URL"].to_s.strip
      uri = URI.parse(value)
      value.chomp("/") if uri.is_a?(URI::HTTPS) && uri.host.present? &&
        uri.userinfo.nil? && uri.query.nil? && uri.fragment.nil? && [ "", "/" ].include?(uri.path)
    rescue URI::InvalidURIError
      nil
    end

    def jitsi_enabled?
      jitsi_base_url.present? && ENV["CAMPFIRE_JITSI_APP_SECRET"].present?
    end

    def jitsi_room_name(room)
      secret = Rails.application.key_generator.generate_key("campfire/jitsi-room-name")
      "campfire#{OpenSSL::HMAC.hexdigest("SHA256", secret, room.id.to_s)}"
    end

    def jitsi_token(room:, user:)
      now = Time.current.to_i
      app_id = ENV.fetch("CAMPFIRE_JITSI_APP_ID", "campfire")
      JWT.encode({
        iss: app_id, aud: app_id,
        sub: ENV.fetch("CAMPFIRE_JITSI_XMPP_DOMAIN", "meet.jitsi"),
        room: jitsi_room_name(room), iat: now, nbf: now - 30, exp: now + 1.hour.to_i,
        context: { user: { id: user.id.to_s, name: user.name } }
      }, ENV.fetch("CAMPFIRE_JITSI_APP_SECRET"), "HS256", typ: "JWT")
    end
  end
end
