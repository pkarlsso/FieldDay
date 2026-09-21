require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'apple-search-completer'
  s.version        = package['version']
  s.summary        = 'Apple MapKit local search autocomplete for FieldDay'
  s.description    = 'Expo module exposing MKLocalSearchCompleter and MKLocalSearch.'
  s.author         = 'FieldDay'
  s.license        = { type: 'MIT' }
  s.homepage       = 'https://github.com/pkarlsso/FieldDay'
  s.platforms      = { ios: '15.1' }
  s.source         = { git: 'https://github.com/pkarlsso/FieldDay.git' }
  s.source_files   = 'ios/**/*.{h,m,swift}'
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
end
