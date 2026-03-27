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
      ENV["CAMPFIRE_JITSI_BASE_URL"].to_s.strip.presence
    end
  end
end
